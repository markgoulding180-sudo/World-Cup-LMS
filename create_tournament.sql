-- Check current picks
SELECT 
  u.username,
  u.display_name,
  COUNT(p.id) as total_picks,
  COUNT(CASE WHEN m.matchday = 1 THEN 1 END) as matchday_1_picks,
  COUNT(CASE WHEN m.matchday = 2 THEN 1 END) as matchday_2_picks,
  COUNT(CASE WHEN m.matchday = 3 THEN 1 END) as matchday_3_picks
FROM users u
LEFT JOIN picks p ON u.id = p.user_id
LEFT JOIN matches m ON p.match_id = m.id
GROUP BY u.id, u.username, u.display_name
ORDER BY u.username;
