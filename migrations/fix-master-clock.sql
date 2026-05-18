-- Migration: Add current_matchday column to master_clock table
ALTER TABLE master_clock ADD COLUMN IF NOT EXISTS current_matchday INTEGER DEFAULT 1;

-- Insert or update the master_clock row
INSERT INTO master_clock (id, current_round, current_matchday, status)
VALUES ('current', 1, 1, 'active')
ON CONFLICT (id) DO UPDATE SET
  current_round = 1,
  current_matchday = 1,
  status = 'active';

-- Verify
SELECT * FROM master_clock;
