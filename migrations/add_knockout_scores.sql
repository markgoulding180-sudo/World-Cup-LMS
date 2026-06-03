-- Migration: Add extra time and penalty columns to matches table
-- This supports knockout stages that go to extra time or penalties

-- Add columns for extra time scores
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS et_home_score INTEGER,
ADD COLUMN IF NOT EXISTS et_away_score INTEGER,
ADD COLUMN IF NOT EXISTS pen_home_score INTEGER,
ADD COLUMN IF NOT EXISTS pen_away_score INTEGER,
ADD COLUMN IF NOT EXISTS winner_team_id UUID REFERENCES teams(id);

-- Add comment to explain the columns
COMMENT ON COLUMN matches.et_home_score IS 'Extra time home team goals (null if match ended in 90 minutes)';
COMMENT ON COLUMN matches.et_away_score IS 'Extra time away team goals (null if match ended in 90 minutes)';
COMMENT ON COLUMN matches.pen_home_score IS 'Penalty shootout home team score (null if no penalties)';
COMMENT ON COLUMN matches.pen_away_score IS 'Penalty shootout away team score (null if no penalties)';
COMMENT ON COLUMN matches.winner_team_id IS 'Explicit winner team ID (null for draws in group stage)';
