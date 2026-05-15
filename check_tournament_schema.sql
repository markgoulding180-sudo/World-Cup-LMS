-- Check what data is currently in the matches table
-- This will show us the source of truth

SELECT 
  m.id,
  m.match_time,
  m.matchday,
  ht.name as home_team,
  at.name as away_team,
  m.created_at
FROM matches m
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id
ORDER BY m.match_time
LIMIT 10;
