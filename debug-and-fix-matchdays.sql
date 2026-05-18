-- Check if data was imported
SELECT 'Teams' as type, COUNT(*) as count FROM teams
UNION ALL
SELECT 'Matches' as type, COUNT(*) as count FROM matches
UNION ALL
SELECT 'Rounds' as type, COUNT(*) as count FROM rounds;
