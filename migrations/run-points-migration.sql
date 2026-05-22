-- World Cup LMS Points-Based System Migration
-- Converts from lives-based to points-based tournament system

-- ============================================
-- 1. Add new columns to tournament_entries
-- ============================================

-- Add total_points column
ALTER TABLE tournament_entries 
ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;

-- Add wins column to track number of winning picks
ALTER TABLE tournament_entries 
ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0;

-- ============================================
-- 2. Add points column to picks table
-- ============================================

ALTER TABLE picks 
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- ============================================
-- 3. Create function to increment points atomically
-- ============================================

CREATE OR REPLACE FUNCTION increment_points(user_id UUID, points INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE tournament_entries 
  SET 
    total_points = total_points + points,
    wins = wins + CASE WHEN points > 0 THEN 1 ELSE 0 END
  WHERE tournament_entries.user_id = increment_points.user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Remove lives columns (optional - keep for backwards compatibility)
-- ============================================

-- Note: Uncomment the following lines if you want to completely remove lives columns
-- ALTER TABLE tournament_entries DROP COLUMN IF EXISTS lives_remaining;
-- ALTER TABLE tournament_entries DROP COLUMN IF EXISTS max_lives;
-- ALTER TABLE tournament_entries DROP COLUMN IF EXISTS eliminated_round;
-- ALTER TABLE tournament_entries DROP COLUMN IF EXISTS eliminated_at;
-- ALTER TABLE tournaments DROP COLUMN IF EXISTS lives;

-- ============================================
-- 5. Update existing data (if migrating mid-tournament)
-- ============================================

-- Calculate points for existing winning picks based on round
-- Group Stage (round 1) = 2 points
UPDATE picks 
SET points = 2 
WHERE result = 'win' 
AND round_id IN (SELECT id FROM rounds WHERE round_number = 1)
AND points = 0;

-- Round of 32 (round 2) = 4 points
UPDATE picks 
SET points = 4 
WHERE result = 'win' 
AND round_id IN (SELECT id FROM rounds WHERE round_number = 2)
AND points = 0;

-- Round of 16 (round 3) = 6 points
UPDATE picks 
SET points = 6 
WHERE result = 'win' 
AND round_id IN (SELECT id FROM rounds WHERE round_number = 3)
AND points = 0;

-- Quarter Finals (round 4) = 8 points
UPDATE picks 
SET points = 8 
WHERE result = 'win' 
AND round_id IN (SELECT id FROM rounds WHERE round_number = 4)
AND points = 0;

-- Semi Finals (round 5) = 10 points
UPDATE picks 
SET points = 10 
WHERE result = 'win' 
AND round_id IN (SELECT id FROM rounds WHERE round_number = 5)
AND points = 0;

-- Final (round 6) = 15 points
UPDATE picks 
SET points = 15 
WHERE result = 'win' 
AND round_id IN (SELECT id FROM rounds WHERE round_number = 6)
AND points = 0;

-- Recalculate total_points and wins for all entries
UPDATE tournament_entries 
SET 
  total_points = COALESCE((
    SELECT SUM(p.points) 
    FROM picks p 
    WHERE p.user_id = tournament_entries.user_id 
    AND p.result = 'win'
  ), 0),
  wins = COALESCE((
    SELECT COUNT(*) 
    FROM picks p 
    WHERE p.user_id = tournament_entries.user_id 
    AND p.result = 'win'
  ), 0);

-- ============================================
-- 6. Update simulations table schema (if exists)
-- ============================================

-- Add final_top5 column if not exists
ALTER TABLE simulations 
ADD COLUMN IF NOT EXISTS final_top5 JSONB;

-- ============================================
-- 7. Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_picks_user_tournament ON picks(user_id, tournament_id);
CREATE INDEX IF NOT EXISTS idx_picks_team ON picks(team_id);
CREATE INDEX IF NOT EXISTS idx_entries_points ON tournament_entries(total_points DESC);

-- ============================================
-- Migration Complete
-- ============================================

SELECT 'Migration complete: Points-based system activated' as status;
