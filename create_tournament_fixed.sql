-- Fix matchday distribution - redistribute all matches evenly
-- Run this in Supabase SQL Editor

-- First, reset all matchdays to NULL for Group Stage
UPDATE matches 
SET matchday = NULL 
WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1);

-- Now redistribute evenly (24 matches per matchday)
DO $$
DECLARE
  group_round_id UUID;
  match_record RECORD;
  match_counter INTEGER := 0;
BEGIN
  SELECT id INTO group_round_id FROM rounds WHERE round_number = 1 LIMIT 1;
  
  IF group_round_id IS NOT NULL THEN
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
  END IF;
END $$;

-- Verify distribution
SELECT 'MATCHES BY MATCHDAY' as info, matchday, COUNT(*) as count 
FROM matches 
WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1) 
GROUP BY matchday 
ORDER BY matchday;
