-- World Cup LMS Database Migrations (FIXED - Idempotent)
-- Run this in Supabase SQL Editor: https://jqctbpuulyhghrxjmqee.supabase.co/project/sql
-- Safe to run multiple times - handles existing constraints/columns

-- ============================================
-- MIGRATION 1: Add Lives System (idempotent)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'lives') THEN
    ALTER TABLE tournaments ADD COLUMN lives INTEGER DEFAULT 3;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournament_entries' AND column_name = 'lives_remaining') THEN
    ALTER TABLE tournament_entries ADD COLUMN lives_remaining INTEGER DEFAULT 3;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournament_entries' AND column_name = 'max_lives') THEN
    ALTER TABLE tournament_entries ADD COLUMN max_lives INTEGER DEFAULT 3;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rounds' AND column_name = 'picks_required') THEN
    ALTER TABLE rounds ADD COLUMN picks_required INTEGER DEFAULT 1;
  END IF;
END $$;

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
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'picks_tournament_id_user_id_round_id_key') THEN
    ALTER TABLE picks DROP CONSTRAINT picks_tournament_id_user_id_round_id_key;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'picks_unique_team_per_round') THEN
    ALTER TABLE picks DROP CONSTRAINT picks_unique_team_per_round;
  END IF;

  ALTER TABLE picks ADD CONSTRAINT picks_unique_team_per_round 
    UNIQUE (tournament_id, user_id, round_id, team_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- MIGRATION 3: Add Matchday Columns (idempotent)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'matchday') THEN
    ALTER TABLE matches ADD COLUMN matchday INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'picks' AND column_name = 'matchday') THEN
    ALTER TABLE picks ADD COLUMN matchday INTEGER;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_matches_matchday ON matches(matchday);
CREATE INDEX IF NOT EXISTS idx_picks_matchday ON picks(matchday);

UPDATE rounds SET picks_required = 9 WHERE round_number = 1 AND picks_required = 3;

-- ============================================
-- MIGRATION 4: Distribute Matches to Matchdays (only if needed)
-- ============================================

DO $$
DECLARE
  group_round_id UUID;
  match_record RECORD;
  match_counter INTEGER := 0;
  unassigned_matches INTEGER;
BEGIN
  SELECT COUNT(*) INTO unassigned_matches 
  FROM matches m
  JOIN rounds r ON m.round_id = r.id
  WHERE r.round_number = 1 AND m.matchday IS NULL;

  IF unassigned_matches > 0 THEN
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
    RAISE NOTICE 'All matches already have matchday assigned';
  END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

SELECT 'ROUNDS' as info, id, name, round_number, picks_required FROM rounds ORDER BY round_number;
SELECT 'MATCHES BY MATCHDAY' as info, matchday, COUNT(*) as count FROM matches WHERE round_id IN (SELECT id FROM rounds WHERE round_number = 1) GROUP BY matchday ORDER BY matchday;
