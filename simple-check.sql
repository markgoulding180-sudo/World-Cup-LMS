-- Show first match to add result
SELECT 
  m.id,
  m.match_time,
  ht.name as home_team,
  at.name as away_team,
  m.matchday,
  m.status
FROM matches m
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id
ORDER BY m.match_time
LIMIT 1;
