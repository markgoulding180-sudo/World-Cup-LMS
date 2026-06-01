-- Migration: Add is_auto_pick column to picks table
-- This marks picks that were automatically assigned for missed rounds

ALTER TABLE picks ADD COLUMN IF NOT EXISTS is_auto_pick BOOLEAN DEFAULT false;

-- Update existing picks to set is_auto_pick = false
UPDATE picks SET is_auto_pick = false WHERE is_auto_pick IS NULL;
