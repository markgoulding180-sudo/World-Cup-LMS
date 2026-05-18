-- Check if import worked
SELECT 'Teams' as type, COUNT(*) as count FROM teams
UNION ALL
SELECT 'Matches' as type, COUNT(*) as count FROM matches;
