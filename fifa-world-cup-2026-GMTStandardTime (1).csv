-- Reset Script: Fresh Start - Keep Teams, Clear Everything Else
-- Run this in Supabase SQL Editor to reset the game while preserving master team data

-- Step 1: Clear dependent tables first (respect foreign key constraints)
-- Order matters: delete child tables before parent tables

-- Clear all picks (user selections)
DELETE FROM picks;

-- Clear all matches
DELETE FROM matches;

-- Clear all tournament entries
DELETE FROM tournament_entries;

-- Clear master clock
DELETE FROM master_clock;

-- Clear all tournaments
DELETE FROM tournaments;

-- Clear all rounds
DELETE FROM rounds;

-- Step 2: Reset team elimination status (all teams active again)
UPDATE teams SET eliminated = false;

-- Step 3: Verify reset
SELECT 
  'teams (master data kept)' as table_name, 
  COUNT(*) as row_count,
  '✓ PRESERVED' as status
FROM teams
UNION ALL
SELECT 
  'rounds', 
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ CLEARED' ELSE '⚠ HAS DATA' END
FROM rounds
UNION ALL
SELECT 
  'matches', 
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ CLEARED' ELSE '⚠ HAS DATA' END
FROM matches
UNION ALL
SELECT 
  'tournaments', 
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ CLEARED' ELSE '⚠ HAS DATA' END
FROM tournaments
UNION ALL
SELECT 
  'tournament_entries', 
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ CLEARED' ELSE '⚠ HAS DATA' END
FROM tournament_entries
UNION ALL
SELECT 
  'picks', 
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ CLEARED' ELSE '⚠ HAS DATA' END
FROM picks
UNION ALL
SELECT 
  'master_clock', 
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ CLEARED' ELSE '⚠ HAS DATA' END
FROM master_clock
ORDER BY table_name;
