-- Debug and fix matchday distribution
-- First, let's see what's happening

-- Check how many total matches we have in Group Stage
SELECT 'Total Group Stage matches' as info, COUNT(*) as count
FROM matches m
JOIN rounds r ON m.round_id = r.id
WHERE r.round_number = 1;

-- Check current matchday distribution
SELECT 'Current distribution' as info, matchday, COUNT(*) as count
FROM matches m
JOIN rounds r ON m.round_id = r.id
WHERE r.round_number = 1
GROUP BY matchday
ORDER BY matchday;

-- Check if there are matches with NULL matchday
SELECT 'NULL matchday count' as info, COUNT(*) as count
FROM matches m
JOIN rounds r ON m.round_id = r.id
WHERE r.round_number = 1 AND matchday IS NULL;

-- Now let's fix by using the actual round_id
DO $$
DECLARE
  group_round_id UUID;
  match_record RECORD;
  match_counter INTEGER := 0;
BEGIN
  -- Get the actual round_id for round_number = 1
  SELECT id INTO group_round_id FROM rounds WHERE round_number = 1 LIMIT 1;
  
  RAISE NOTICE 'Using round_id: %', group_round_id;
  
  -- Reset ALL matches for this round to NULL
  UPDATE matches SET matchday = NULL WHERE round_id = group_round_id;
  
  -- Now redistribute
  FOR match_record IN 
    SELECT id FROM matches 
    WHERE round_id = group_round_id
    ORDER BY match_time
  LOOP
    match_counter := match_counter + 1;
    
    UPDATE matches 
    SET matchday = CASE 
      WHEN match_counter <= 24 THEN 1
      WHEN match_counter <= 48 THEN 2
      ELSE 3
    END
    WHERE id = match_record.id;
  END LOOP;
  
  RAISE NOTICE 'Assigned % matches to matchdays', match_counter;
END $$;

-- Final verification
SELECT 'Final distribution' as info, matchday, COUNT(*) as count
FROM matches m
JOIN rounds r ON m.round_id = r.id
WHERE r.round_number = 1
GROUP BY matchday
ORDER BY matchday;
