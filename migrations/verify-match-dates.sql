-- Verify matches are assigned to correct matchdays based on dates
-- World Cup 2026 Group Stage:
-- Matchday 1: June 11-17, 2026
-- Matchday 2: June 18-24, 2026
-- Matchday 3: June 25-27, 2026

-- Check match distribution by date
SELECT 
  matchday,
  DATE(match_time) as match_date,
  COUNT(*) as match_count
FROM matches
WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1)
GROUP BY matchday, DATE(match_time)
ORDER BY matchday, match_date;

-- Show some sample matches from each matchday to verify
SELECT '=== MATCHDAY 1 SAMPLES ===' as section;
SELECT home_team_id, away_team_id, match_time, matchday
FROM matches
WHERE matchday = 1
ORDER BY match_time
LIMIT 5;

SELECT '=== MATCHDAY 2 SAMPLES ===' as section;
SELECT home_team_id, away_team_id, match_time, matchday
FROM matches
WHERE matchday = 2
ORDER BY match_time
LIMIT 5;

SELECT '=== MATCHDAY 3 SAMPLES ===' as section;
SELECT home_team_id, away_team_id, match_time, matchday
FROM matches
WHERE matchday = 3
ORDER BY match_time
LIMIT 5;
