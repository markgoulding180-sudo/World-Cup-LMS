-- Migration: Add matchday column to matches and picks tables
-- Run this in Supabase SQL Editor

-- Add matchday column to matches table (for group stage matchdays 1-3)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS matchday INTEGER;

-- Add matchday column to picks table (to track which matchday each pick belongs to)
ALTER TABLE picks ADD COLUMN IF NOT EXISTS matchday INTEGER;

-- Update existing matches to have matchday based on round
-- Group stage matches (round 1) get matchday 1, 2, or 3
-- This is a one-time fix for existing data
UPDATE matches SET matchday = 1 WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1) AND matchday IS NULL;

-- Create index for faster matchday queries
CREATE INDEX IF NOT EXISTS idx_matches_matchday ON matches(matchday);
CREATE INDEX IF NOT EXISTS idx_picks_matchday ON picks(matchday);

-- Update rounds table: Group Stage now has 9 picks (3 per matchday)
UPDATE rounds SET picks_required = 9 WHERE round_number = 1 AND name ILIKE '%group%';

-- Ensure other rounds have 1 pick
UPDATE rounds SET picks_required = 1 WHERE round_number > 1;
