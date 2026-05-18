-- Verify fresh import
SELECT 
  'Teams' as item, COUNT(*) as count FROM teams
UNION ALL
SELECT 'Matches', COUNT(*) FROM matches
UNION ALL
SELECT 'Rounds', COUNT(*) FROM rounds
UNION ALL
SELECT 'Master Teams', COUNT(*) FROM master_teams;
