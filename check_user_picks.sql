-- Check current picks with correct schema
SELECT 
  u.username,
  u.display_name,
  COUNT(p.id) as total_picks,
  COUNT(CASE WHEN p.matchday = 1 THEN 1 END) as matchday_1_picks,
  COUNT(CASE WHEN p.matchday = 2 THEN 1 END) as matchday_2_picks,
  COUNT(CASE WHEN p.matchday = 3 THEN 1 END) as matchday_3_picks
FROM users u
LEFT JOIN picks p ON u.id = p.user_id
GROUP BY u.id, u.username, u.display_name
ORDER BY u.username;
