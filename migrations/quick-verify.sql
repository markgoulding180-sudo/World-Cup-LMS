-- Quick Tournament Setup Verification
-- Run this in Supabase SQL Editor

-- Expected Results:
-- master_teams: 48
-- teams: 48
-- tournaments: 1
-- rounds: 6
-- matches: 72
-- users: 0 (until someone registers)
-- tournament_entries: 0 (until someone enters)
-- picks: 0 (until someone picks)
-- master_clock: 1

SELECT 
  'master_teams' as table_name, 
  (SELECT COUNT(*) FROM master_teams) as expected_48,
  (SELECT COUNT(*) FROM master_teams) as actual_count,
  CASE WHEN (SELECT COUNT(*) FROM master_teams) = 48 THEN '✅' ELSE '❌' END as status

UNION ALL SELECT 
  'teams', 48, (SELECT COUNT(*) FROM teams),
  CASE WHEN (SELECT COUNT(*) FROM teams) = 48 THEN '✅' ELSE '❌' END

UNION ALL SELECT 
  'tournaments', 1, (SELECT COUNT(*) FROM tournaments),
  CASE WHEN (SELECT COUNT(*) FROM tournaments) = 1 THEN '✅' ELSE '❌' END

UNION ALL SELECT 
  'rounds', 6, (SELECT COUNT(*) FROM rounds),
  CASE WHEN (SELECT COUNT(*) FROM rounds) = 6 THEN '✅' ELSE '❌' END

UNION ALL SELECT 
  'matches', 72, (SELECT COUNT(*) FROM matches),
  CASE WHEN (SELECT COUNT(*) FROM matches) = 72 THEN '✅' ELSE '❌' END

UNION ALL SELECT 
  'master_clock', 1, (SELECT COUNT(*) FROM master_clock),
  CASE WHEN (SELECT COUNT(*) FROM master_clock) = 1 THEN '✅' ELSE '❌' END;

-- Tournament Config Check
SELECT 
  'Tournament Config' as check_item,
  name as value,
  CASE 
    WHEN entry_fee = 30 AND max_players = 100 AND lives = 3 AND status = 'open'
    THEN '✅ Correct'
    ELSE '❌ Wrong config'
  END as status
FROM tournaments;

-- Master Clock Check
SELECT 
  'Master Clock' as check_item,
  'Round ' || current_round || ', Matchday ' || current_matchday || ' (' || status || ')' as value,
  CASE 
    WHEN current_round = 1 AND current_matchday = 1 AND status = 'active'
    THEN '✅ Ready'
    ELSE '❌ Not ready'
  END as status
FROM master_clock
WHERE id = 'current';

-- Rounds Check
SELECT 
  'Round ' || round_number as check_item,
  name || ' (' || status || ')' as value,
  CASE 
    WHEN (round_number = 1 AND status = 'open') 
      OR (round_number > 1 AND status = 'upcoming')
    THEN '✅'
    ELSE '❌'
  END as status
FROM rounds
ORDER BY round_number;
