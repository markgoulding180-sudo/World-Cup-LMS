-- ============================================
-- SIMULATE 100 USERS AND TOURNAMENT PICKS
-- Run these scripts in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: CREATE 100 TEST USERS
-- ============================================

-- First, create auth users (this would normally be done via API, but we'll simulate)
-- For testing, we'll insert directly into public.users and bypass auth

DO $$
DECLARE
    i INTEGER;
    user_id UUID;
    tournament_uuid UUID;
BEGIN
    -- Get tournament ID
    SELECT id INTO tournament_uuid FROM tournaments LIMIT 1;
    
    IF tournament_uuid IS NULL THEN
        RAISE EXCEPTION 'No tournament found. Run Setup Tournament first.';
    END IF;
    
    -- Create 100 test users
    FOR i IN 1..100 LOOP
        user_id := gen_random_uuid();
        
        -- Insert into users table
        INSERT INTO users (id, username, display_name, email)
        VALUES (
            user_id,
            'player' || i,
            'Player ' || i,
            'player' || i || '@test.com'
        )
        ON CONFLICT (id) DO NOTHING;
        
        -- Enter tournament for each user
        INSERT INTO tournament_entries (tournament_id, user_id, status, lives_remaining, max_lives)
        VALUES (tournament_uuid, user_id, 'active', 3, 3)
        ON CONFLICT (tournament_id, user_id) DO NOTHING;
        
    END LOOP;
    
    RAISE NOTICE 'Created 100 test users and tournament entries';
END $$;

-- Verify users created
SELECT 'Users created' as check_item, COUNT(*) as count FROM users;
SELECT 'Tournament entries' as check_item, COUNT(*) as count FROM tournament_entries;
