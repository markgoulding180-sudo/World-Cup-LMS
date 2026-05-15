-- Check what matches are in the overlapping dates
-- June 24 has matches in both matchday 2 and 3

SELECT 
  DATE(match_time) as match_date,
  matchday,
  COUNT(*) as match_count,
  STRING_AGG(home_team_id::text || ' vs ' || away_team_id::text, ', ') as matches
FROM matches
WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1)
  AND DATE(match_time) BETWEEN '2026-06-23' AND '2026-06-26'
GROUP BY DATE(match_time), matchday
ORDER BY match_date, matchday;

-- Show all matches on June 24 to see the issue
SELECT '=== JUNE 24 MATCHES ===' as section;
SELECT 
  m.match_time,
  m.matchday,
  ht.name as home_team,
  at.name as away_team
FROM matches m
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id
WHERE DATE(m.match_time) = '2026-06-24'
ORDER BY m.match_time;
