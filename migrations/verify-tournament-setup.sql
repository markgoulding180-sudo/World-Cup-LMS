-- Comprehensive Tournament Setup Verification Script
-- Run this in Supabase SQL Editor to verify everything is correctly set up

-- ============================================
-- 1. CHECK MASTER_TEAMS (Source of flag images)
-- ============================================
SELECT 'MASTER_TEAMS' as table_name, COUNT(*) as row_count FROM master_teams
UNION ALL

-- ============================================
-- 2. CHECK TEAMS (Copied from master_teams)
-- ============================================
SELECT 'TEAMS' as table_name, COUNT(*) as row_count FROM teams
UNION ALL

-- ============================================
-- 3. CHECK TOURNAMENT
-- ============================================
SELECT 'TOURNAMENTS' as table_name, COUNT(*) as row_count FROM tournaments
UNION ALL

-- ============================================
-- 4. CHECK ROUNDS
-- ============================================
SELECT 'ROUNDS' as table_name, COUNT(*) as row_count FROM rounds
UNION ALL

-- ============================================
-- 5. CHECK MATCHES
-- ============================================
SELECT 'MATCHES' as table_name, COUNT(*) as row_count FROM matches
UNION ALL

-- ============================================
-- 6. CHECK USERS
-- ============================================
SELECT 'USERS' as table_name, COUNT(*) as row_count FROM users
UNION ALL

-- ============================================
-- 7. CHECK TOURNAMENT ENTRIES
-- ============================================
SELECT 'TOURNAMENT_ENTRIES' as table_name, COUNT(*) as row_count FROM tournament_entries
UNION ALL

-- ============================================
-- 8. CHECK PICKS
-- ============================================
SELECT 'PICKS' as table_name, COUNT(*) as row_count FROM picks
UNION ALL

-- ============================================
-- 9. CHECK MASTER_CLOCK
-- ============================================
SELECT 'MASTER_CLOCK' as table_name, COUNT(*) as row_count FROM master_clock;

-- ============================================
-- DETAILED CHECKS
-- ============================================

-- Tournament Details
SELECT 
  'TOURNAMENT DETAILS' as check_type,
  name,
  entry_fee,
  max_players,
  lives,
  status
FROM tournaments
LIMIT 1;

-- Rounds Details
SELECT 
  'ROUNDS DETAILS' as check_type,
  round_number,
  name,
  picks_required,
  status
FROM rounds
ORDER BY round_number;

-- Master Clock Status
SELECT 
  'MASTER CLOCK' as check_type,
  current_round,
  current_matchday,
  status
FROM master_clock
WHERE id = 'current';

-- Match Distribution by Matchday
SELECT 
  'MATCHES BY MATCHDAY' as check_type,
  matchday,
  COUNT(*) as match_count
FROM matches
GROUP BY matchday
ORDER BY matchday;

-- Teams Sample (first 10)
SELECT 
  'TEAMS SAMPLE' as check_type,
  name,
  code,
  group_name,
  SUBSTRING(flag_url, 1, 50) as flag_url_preview
FROM teams
ORDER BY group_name, name
LIMIT 10;

-- Check for any teams without flag URLs
SELECT 
  'TEAMS WITHOUT FLAGS' as check_type,
  COUNT(*) as count
FROM teams
WHERE flag_url IS NULL OR flag_url = '';

-- Check for any matches with missing team references
SELECT 
  'MATCHES WITH MISSING TEAMS' as check_type,
  COUNT(*) as count
FROM matches m
LEFT JOIN teams ht ON m.home_team_id = ht.id
LEFT JOIN teams at ON m.away_team_id = at.id
WHERE ht.id IS NULL OR at.id IS NULL;

-- Upcoming vs Finished Matches
SELECT 
  'MATCH STATUS' as check_type,
  status,
  COUNT(*) as count
FROM matches
GROUP BY status;
