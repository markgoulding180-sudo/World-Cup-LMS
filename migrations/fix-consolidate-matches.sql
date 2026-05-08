-- Fix: Consolidate all Group Stage matches into Round 1
-- and properly distribute them across matchdays 1, 2, 3

-- Step 1: Get the Round 1 ID
DO $$
DECLARE
  round1_id UUID;
  round2_id UUID;
  round3_id UUID;
  match_record RECORD;
  match_counter INTEGER := 0;
BEGIN
  -- Get round IDs
  SELECT id INTO round1_id FROM rounds WHERE round_number = 1 LIMIT 1;
  SELECT id INTO round2_id FROM rounds WHERE round_number = 2 LIMIT 1;
  SELECT id INTO round3_id FROM rounds WHERE round_number = 3 LIMIT 1;
  
  RAISE NOTICE 'Round 1 ID: %, Round 2 ID: %, Round 3 ID: %', round1_id, round2_id, round3_id;
  
  -- Step 2: Move matches from Round 2 to Round 1
  IF round2_id IS NOT NULL THEN
    UPDATE matches SET round_id = round1_id WHERE round_id = round2_id;
    RAISE NOTICE 'Moved matches from Round 2 to Round 1';
  END IF;
  
  -- Step 3: Move matches from Round 3 to Round 1
  IF round3_id IS NOT NULL THEN
    UPDATE matches SET round_id = round1_id WHERE round_id = round3_id;
    RAISE NOTICE 'Moved matches from Round 3 to Round 1';
  END IF;
  
  -- Step 4: Reset all matchdays in Round 1
  UPDATE matches SET matchday = NULL WHERE round_id = round1_id;
  
  -- Step 5: Redistribute evenly (24 per matchday)
  FOR match_record IN 
    SELECT id FROM matches 
    WHERE round_id = round1_id
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
  
  RAISE NOTICE 'Distributed % matches across 3 matchdays', match_counter;
END $$;

-- Verify the fix
SELECT '=== AFTER FIX ===' as section;
SELECT r.round_number, r.name, COUNT(m.id) as matches,
       COUNT(CASE WHEN m.matchday = 1 THEN 1 END) as matchday_1,
       COUNT(CASE WHEN m.matchday = 2 THEN 1 END) as matchday_2,
       COUNT(CASE WHEN m.matchday = 3 THEN 1 END) as matchday_3
FROM rounds r
LEFT JOIN matches m ON m.round_id = r.id
GROUP BY r.id, r.round_number, r.name
ORDER BY r.round_number;
