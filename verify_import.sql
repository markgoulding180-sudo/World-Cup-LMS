-- Show Mark G's picks
SELECT 
  p.matchday,
  t.name as team,
  t.group_name,
  p.result
FROM picks p
JOIN teams t ON p.team_id = t.id
JOIN users u ON p.user_id = u.id
WHERE u.username = 'Mark G'
ORDER BY p.matchday, t.name;
