-- World Cup LMS - Idempotent Migrations (Safe to run multiple times)
-- Run this in Supabase SQL Editor

-- ============================================
-- MIGRATION 1: Add Lives System (idempotent)
-- ============================================

DO $$
BEGIN
  -- Add lives to tournaments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'lives') THEN
    ALTER TABLE tournaments ADD COLUMN lives INTEGER DEFAULT 3;
  END IF;

  -- Add lives_remaining to entries
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournament_entries' AND column_name = 'lives_remaining') THEN
    ALTER TABLE tournament_entries ADD COLUMN lives_remaining INTEGER DEFAULT 3;
  END IF;

  -- Add max_lives to entries
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournament_entries' AND column_name = 'max_lives') THEN
    ALTER TABLE tournament_entries ADD COLUMN max_lives INTEGER DEFAULT 3;
  END IF;

  -- Add picks_required to rounds
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rounds' AND column_name = 'picks_required') THEN
    ALTER TABLE rounds ADD COLUMN picks_required INTEGER DEFAULT 1;
  END IF;
END $$;

-- Update data (safe to run multiple times)
UPDATE tournaments SET lives = 3 WHERE lives IS NULL;
UPDATE tournament_entries SET lives_remaining = 3, max_lives = 3 WHERE lives_remaining IS NULL;
UPDATE rounds SET picks_required = 1 WHERE picks_required IS NULL;
UPDATE rounds SET picks_required = 3 WHERE round_number <= 3 AND picks_required = 1;
UPDATE rounds SET picks_required = 1 WHERE round_number > 3 AND picks_required = 3;

-- ============================================
-- MIGRATION 2: Allow Multiple Picks (idempotent)
-- ============================================

DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'picks_tournament_id_user_id_round_id_key') THEN
    ALTER TABLE picks DROP CONSTRAINT picks_tournament_id_user_id_round_id_key;
  END IF;

  -- Drop new constraint if exists (to recreate)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'picks_unique_team_per_round') THEN
    ALTER TABLE picks DROP CONSTRAINT picks_unique_team_per_round;
  END IF;

  -- Add new constraint
  ALTER TABLE picks ADD CONSTRAINT picks_unique_team_per_round 
    UNIQUE (tournament_id, user_id, round_id, team_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- MIGRATION 3: Add Matchday Columns (idempotent)
-- ============================================

DO $$
BEGIN
  -- Add matchday to matches
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'matchday') THEN
    ALTER TABLE matches ADD COLUMN matchday INTEGER;
  END IF;

  -- Add matchday to picks
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'picks' AND column_name = 'matchday') THEN
    ALTER TABLE picks ADD COLUMN matchday INTEGER;
  END IF;
END $$;

-- Create indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_matches_matchday ON matches(matchday);
CREATE INDEX IF NOT EXISTS idx_picks_matchday ON picks(matchday);

-- Update Group Stage picks_required
UPDATE rounds SET picks_required = 9 WHERE round_number = 1 AND picks_required = 3;

-- ============================================
-- MIGRATION 4: Distribute Matches to Matchdays (only if not already done)
-- ============================================

DO $$
DECLARE
  group_round_id UUID;
  match_record RECORD;
  match_counter INTEGER := 0;
  matches_without_matchday INTEGER;
BEGIN
  -- Check if matches already have matchday assigned
  SELECT COUNT(*) INTO matches_without_matchday 
  FROM matches m
  JOIN rounds r ON m.round_id = r.id
  WHERE r.round_number = 1 AND m.matchday IS NULL;

  -- Only proceed if there are matches without matchday
  IF matches_without_matchday > 0 THEN
    SELECT id INTO group_round_id FROM rounds WHERE round_number = 1 LIMIT 1;
    
    IF group_round_id IS NOT NULL THEN
      FOR match_record IN 
        SELECT id FROM matches 
        WHERE round_id = group_round_id AND matchday IS NULL
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
  ELSE
    RAISE NOTICE 'Matches already have matchday assigned, skipping';
  END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

SELECT 'ROUNDS CONFIG' as check_type;
SELECT id, name, round_number, picks_required FROM rounds ORDER BY round_number;

SELECT 'MATCHDAY DISTRIBUTION' as check_type;
SELECT matchday, COUNT(*) as match_count 
FROM matches m
JOIN rounds r ON m.round_id = r.id
WHERE r.round_number = 1
GROUP BY matchday
ORDER BY matchday;

SELECT 'PICKS TABLE COLUMNS' as check_type;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'picks' 
ORDER BY ordinal_position;
