-- Verify matchday distribution and times are UTC
SELECT 
  matchday,
  COUNT(*) as count,
  MIN(match_time) as earliest,
  MAX(match_time) as latest
FROM matches
GROUP BY matchday
ORDER BY matchday;
