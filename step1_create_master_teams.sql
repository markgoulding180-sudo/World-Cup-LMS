-- Step 2: Clear matches and teams, then re-import from fixturedownload

-- First, clear matches (keep rounds)
DELETE FROM matches;

-- Clear teams
DELETE FROM teams;

-- Verify cleared
SELECT 'Matches cleared' as status, COUNT(*) as count FROM matches
UNION ALL
SELECT 'Teams cleared' as status, COUNT(*) as count FROM teams;
