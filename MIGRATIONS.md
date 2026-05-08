# World Cup LMS - Database Migrations

## Quick Setup

### Option 1: Copy-Paste into Supabase SQL Editor (Easiest)

1. Go to: https://jqctbpuulyhghrxjmqee.supabase.co/project/sql
2. Copy the SQL below
3. Paste into the SQL Editor
4. Click **Run**

---

## Migration SQL

Copy everything below this line into Supabase:

```sql
-- ============================================
-- MIGRATION 1: Add Lives System
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
UPDATE rounds SET picks_required = 3 WHERE round_number <= 3;
UPDATE rounds SET picks_required = 1 WHERE round_number > 3;

-- ============================================
-- MIGRATION 2: Allow Multiple Picks Per Round
-- ============================================

-- Drop the old unique constraint that only allowed 1 pick per round
ALTER TABLE picks DROP CONSTRAINT IF EXISTS picks_tournament_id_user_id_round_id_key;

-- Add new constraint: prevents duplicate teams in same round, but allows multiple picks
ALTER TABLE picks ADD CONSTRAINT picks_unique_team_per_round 
  UNIQUE (tournament_id, user_id, round_id, team_id);

-- ============================================
-- MIGRATION 3: Add Matchday Columns
-- ============================================

-- Add matchday column to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS matchday INTEGER;

-- Add matchday column to picks table
ALTER TABLE picks ADD COLUMN IF NOT EXISTS matchday INTEGER;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_matches_matchday ON matches(matchday);
CREATE INDEX IF NOT EXISTS idx_picks_matchday ON picks(matchday);

-- Update Group Stage to require 9 picks (3 per matchday)
UPDATE rounds SET picks_required = 9 WHERE round_number = 1 AND name ILIKE '%group%';

-- ============================================
-- MIGRATION 4: Distribute Matches to Matchdays
-- ============================================

-- Assign matchday based on chronological order
DO $$
DECLARE
  group_round_id UUID;
  match_record RECORD;
  match_counter INTEGER := 0;
BEGIN
  SELECT id INTO group_round_id FROM rounds WHERE round_number = 1 LIMIT 1;
  
  IF group_round_id IS NOT NULL THEN
    FOR match_record IN 
      SELECT id FROM matches 
      WHERE round_id = group_round_id 
      ORDER BY match_time
    LOOP
      match_counter := match_counter + 1;
      
      UPDATE matches 
      SET matchday = CASE 
        WHEN match_counter <= 24 THEN 1
        WHEN match_counter <= 48 THEN 2
        ELSE 3
      END
      WHERE id = match_record.id;
    END LOOP;
    
    RAISE NOTICE 'Assigned % matches to matchdays', match_counter;
  END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES (optional - run to check)
-- ============================================

-- Check rounds configuration
SELECT id, name, round_number, picks_required FROM rounds ORDER BY round_number;

-- Check matches have matchday assigned
SELECT matchday, COUNT(*) FROM matches WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1) GROUP BY matchday;

-- Check picks table columns
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'picks' ORDER BY ordinal_position;
```

---

## After Running Migrations

1. **Verify in Supabase:**
   - Go to Table Editor → `rounds` table
   - Check `picks_required` column shows 9 for Group Stage
   - Go to `matches` table, check `matchday` column is populated

2. **Deploy to Vercel:**
   ```bash
   git push
   ```
   Or deploy manually from Vercel dashboard

3. **Test the app:**
   - Enter tournament
   - Make 3 picks for Matchday 1
   - Should auto-advance to Matchday 2
