-- Reset script: Clear all data except master_teams
-- Run this before re-importing from fixturedownload

-- Delete in correct order (foreign key constraints)
DELETE FROM picks;
DELETE FROM matches;
DELETE FROM teams;
DELETE FROM rounds;
DELETE FROM tournaments;

-- Verify cleared
SELECT 
  'picks' as table_name, COUNT(*) as count FROM picks
UNION ALL
SELECT 'matches', COUNT(*) FROM matches
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'rounds', COUNT(*) FROM rounds
UNION ALL
SELECT 'tournaments', COUNT(*) FROM tournaments
UNION ALL
SELECT 'master_teams (kept)', COUNT(*) FROM master_teams;
