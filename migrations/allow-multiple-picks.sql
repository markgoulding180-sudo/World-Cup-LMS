-- Migration: Remove unique constraint to allow multiple picks per round
-- Run this in Supabase SQL Editor

-- First, check if the constraint exists and drop it
ALTER TABLE picks DROP CONSTRAINT IF EXISTS picks_tournament_id_user_id_round_id_key;

-- Add a new constraint that allows multiple picks per round but prevents duplicate teams in same round
-- This ensures a player can't pick the same team twice in the same round
ALTER TABLE picks ADD CONSTRAINT picks_unique_team_per_round 
  UNIQUE (tournament_id, user_id, round_id, team_id);
