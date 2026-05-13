-- Full diagnostic of the database state

-- 1. Total matches per round
SELECT '=== MATCHES BY ROUND ===' as section;
SELECT r.round_number, r.name, COUNT(m.id) as match_count,
       COUNT(CASE WHEN m.matchday IS NOT NULL THEN 1 END) as with_matchday,
       COUNT(CASE WHEN m.matchday IS NULL THEN 1 END) as without_matchday
FROM rounds r
LEFT JOIN matches m ON m.round_id = r.id
GROUP BY r.id, r.round_number, r.name
ORDER BY r.round_number;

-- 2. Total count
SELECT '=== TOTALS ===' as section;
SELECT COUNT(*) as total_matches FROM matches;
SELECT COUNT(*) as total_with_matchday FROM matches WHERE matchday IS NOT NULL;
SELECT COUNT(*) as total_without_matchday FROM matches WHERE matchday IS NULL;

-- 3. Check if we need to consolidate all matches into Round 1
SELECT '=== SHOULD WE CONSOLIDATE? ===' as section;
SELECT 
  'Group Stage should have 72 matches' as expected,
  COUNT(CASE WHEN r.round_number = 1 THEN 1 END) as currently_in_round_1,
  COUNT(CASE WHEN r.round_number IN (2,3) THEN 1 END) as currently_in_rounds_2_3
FROM matches m
JOIN rounds r ON m.round_id = r.id;
