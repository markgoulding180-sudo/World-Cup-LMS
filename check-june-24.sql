-- Migration: Add lives system and multi-pick support
-- Run this in Supabase SQL Editor

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
