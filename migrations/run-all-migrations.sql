-- World Cup LMS Database Migrations
-- Run this in Supabase SQL Editor: https://jqctbpuulyhghrxjmqee.supabase.co/project/sql

-- ============================================
-- MIGRATION 1: Add Lives System (add-lives-system.sql)
-- ============================================

-- Add lives setting to tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS lives INTEGER DEFAULT 3;

-- Add lives tracking to tournament entries
ALTER TABLE tournament_entries 
  ADD COLUMN IF NOT EXISTS lives_remaining INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_lives INTEGER DEFAULT 3;

-- Add picks required per round
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS picks_required INTEGER DEFAULT 1;

-- Update existing data
UPDATE tournaments SET lives = 3 WHERE lives IS NULL;
UPDATE tournament_entries SET lives_remaining = 3, max_lives = 3 WHERE lives_remaining IS NULL;
UPDATE rounds SET picks_required = 1 WHERE picks_required IS NULL;

-- Update round picks_required based on round number
-- Group stage rounds (1-3) = 3 picks, knockouts = 1 pick
UPDATE rounds SET picks_required = 3 WHERE round_number <= 3;
UPDATE rounds SET picks_required = 1 WHERE round_number > 3;

-- ============================================
-- MIGRATION 2: Allow Multiple Picks (allow-multiple-picks.sql)
-- ============================================

-- Drop the old unique constraint that only allowed 1 pick per round
ALTER TABLE picks DROP CONSTRAINT IF EXISTS picks_tournament_id_user_id_round_id_key;

-- Add new constraint: prevents duplicate teams in same round, but allows multiple picks
ALTER TABLE picks ADD CONSTRAINT picks_unique_team_per_round 
  UNIQUE (tournament_id, user_id, round_id, team_id);

-- ============================================
-- MIGRATION 3: Add Matchday Columns (add-matchday-columns.sql)
-- ============================================

-- Add matchday column to matches table (for group stage matchdays 1-3)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS matchday INTEGER;

-- Add matchday column to picks table (to track which matchday each pick belongs to)
ALTER TABLE picks ADD COLUMN IF NOT EXISTS matchday INTEGER;

-- Update existing matches to have matchday based on round
-- Group stage matches (round 1) get matchday 1, 2, or 3
-- This is a one-time fix for existing data - distributes matches evenly
UPDATE matches SET matchday = 1 
WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1) 
AND matchday IS NULL
AND id IN (SELECT id FROM matches WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1) ORDER BY match_time LIMIT 24);

UPDATE matches SET matchday = 2 
WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1) 
AND matchday IS NULL
AND id IN (SELECT id FROM matches WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1) ORDER BY match_time OFFSET 24 LIMIT 24);

UPDATE matches SET matchday = 3 
WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1) 
AND matchday IS NULL;

-- Create index for faster matchday queries
CREATE INDEX IF NOT EXISTS idx_matches_matchday ON matches(matchday);
CREATE INDEX IF NOT EXISTS idx_picks_matchday ON picks(matchday);

-- Update rounds table: Group Stage now has 9 picks (3 per matchday)
UPDATE rounds SET picks_required = 9 WHERE round_number = 1 AND name ILIKE '%group%';

-- Ensure other rounds have 1 pick
UPDATE rounds SET picks_required = 1 WHERE round_number > 1;

-- ============================================
-- VERIFICATION QUERIES (run these to check success)
-- ============================================

-- Check rounds configuration
-- SELECT id, name, round_number, picks_required FROM rounds ORDER BY round_number;

-- Check matches have matchday assigned
-- SELECT matchday, COUNT(*) FROM matches WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1) GROUP BY matchday;

-- Check picks table structure
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'picks' ORDER BY ordinal_position;
