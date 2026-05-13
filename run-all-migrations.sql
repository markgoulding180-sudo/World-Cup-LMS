-- Fix matchday assignments based on real World Cup 2026 dates
-- Matchday 1: June 11-17, 2026
-- Matchday 2: June 18-24, 2026
-- Matchday 3: June 25-27, 2026

DO $$
DECLARE
  round1_id UUID;
  match_record RECORD;
BEGIN
  SELECT id INTO round1_id FROM rounds WHERE round_number = 1 LIMIT 1;
  
  -- Reset all matchdays first
  UPDATE matches SET matchday = NULL WHERE round_id = round1_id;
  
  -- Assign matchdays based on actual dates
  FOR match_record IN 
    SELECT id, match_time FROM matches 
    WHERE round_id = round1_id
    ORDER BY match_time
  LOOP
    UPDATE matches 
    SET matchday = CASE 
      -- Matchday 1: June 11-17
      WHEN DATE(match_record.match_time) BETWEEN '2026-06-11' AND '2026-06-17' THEN 1
      -- Matchday 2: June 18-24
      WHEN DATE(match_record.match_time) BETWEEN '2026-06-18' AND '2026-06-24' THEN 2
      -- Matchday 3: June 25-27
      WHEN DATE(match_record.match_time) BETWEEN '2026-06-25' AND '2026-06-27' THEN 3
      -- Default to matchday 3 for anything else
      ELSE 3
    END
    WHERE id = match_record.id;
  END LOOP;
END $$;

-- Verify the fix
SELECT 
  matchday,
  DATE(match_time) as match_date,
  COUNT(*) as match_count
FROM matches
WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1)
GROUP BY matchday, DATE(match_time)
ORDER BY matchday, match_date;

-- Show totals per matchday
SELECT '=== TOTALS BY MATCHDAY ===' as section;
SELECT matchday, COUNT(*) as total_matches
FROM matches
WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1)
GROUP BY matchday
ORDER BY matchday;
