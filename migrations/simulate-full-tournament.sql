-- ============================================
-- ALL-IN-ONE SIMULATION SCRIPT
-- Run this single script to simulate the entire tournament
-- ============================================

-- Step 1: Create 100 users and tournament entries
DO $$
DECLARE
    i INTEGER;
    user_id UUID;
    tournament_uuid UUID;
BEGIN
    SELECT id INTO tournament_uuid FROM tournaments LIMIT 1;
    IF tournament_uuid IS NULL THEN
        RAISE EXCEPTION 'No tournament found. Run Setup Tournament first.';
    END IF;
    
    FOR i IN 1..100 LOOP
        user_id := gen_random_uuid();
        INSERT INTO users (id, username, display_name, email)
        VALUES (user_id, 'player' || i, 'Player ' || i, 'player' || i || '@test.com')
        ON CONFLICT (id) DO NOTHING;
        
        INSERT INTO tournament_entries (tournament_id, user_id, status, lives_remaining, max_lives)
        VALUES (tournament_uuid, user_id, 'active', 3, 3)
        ON CONFLICT (tournament_id, user_id) DO NOTHING;
    END LOOP;
END $$;

-- Step 2: Simulate Matchday 1 picks
DO $$
DECLARE
    user_record RECORD;
    tournament_uuid UUID;
    round_uuid UUID;
    team_to_pick UUID;
    pick_count INTEGER;
    picked_teams UUID[];
BEGIN
    SELECT id INTO tournament_uuid FROM tournaments LIMIT 1;
    SELECT id INTO round_uuid FROM rounds WHERE round_number = 1 LIMIT 1;
    
    FOR user_record IN SELECT user_id FROM tournament_entries WHERE status = 'active' LOOP
        pick_count := 0;
        picked_teams := ARRAY[]::UUID[];
        
        WHILE pick_count < 3 LOOP
            SELECT team_id INTO team_to_pick
            FROM (
                SELECT home_team_id as team_id FROM matches WHERE matchday = 1
                UNION SELECT away_team_id FROM matches WHERE matchday = 1
            ) t
            WHERE NOT (team_id = ANY(picked_teams))
            ORDER BY random()
            LIMIT 1;
            
            IF team_to_pick IS NULL THEN EXIT; END IF;
            
            INSERT INTO picks (tournament_id, user_id, round_id, team_id, matchday, result)
            VALUES (tournament_uuid, user_record.user_id, round_uuid, team_to_pick, 1, 'pending')
            ON CONFLICT DO NOTHING;
            
            picked_teams := array_append(picked_teams, team_to_pick);
            pick_count := pick_count + 1;
        END LOOP;
    END LOOP;
END $$;

-- Step 3: Simulate Matchday 2 picks
DO $$
DECLARE
    user_record RECORD;
    tournament_uuid UUID;
    round_uuid UUID;
    team_to_pick UUID;
    pick_count INTEGER;
    picked_teams UUID[];
    previously_picked UUID[];
BEGIN
    SELECT id INTO tournament_uuid FROM tournaments LIMIT 1;
    SELECT id INTO round_uuid FROM rounds WHERE round_number = 1 LIMIT 1;
    
    FOR user_record IN SELECT user_id FROM tournament_entries WHERE status = 'active' LOOP
        SELECT ARRAY_AGG(team_id) INTO previously_picked FROM picks WHERE user_id = user_record.user_id;
        pick_count := 0;
        picked_teams := ARRAY[]::UUID[];
        
        WHILE pick_count < 3 LOOP
            SELECT team_id INTO team_to_pick
            FROM (
                SELECT home_team_id as team_id FROM matches WHERE matchday = 2
                UNION SELECT away_team_id FROM matches WHERE matchday = 2
            ) t
            WHERE NOT (team_id = ANY(COALESCE(previously_picked, ARRAY[]::UUID[])))
              AND NOT (team_id = ANY(picked_teams))
            ORDER BY random()
            LIMIT 1;
            
            IF team_to_pick IS NULL THEN EXIT; END IF;
            
            INSERT INTO picks (tournament_id, user_id, round_id, team_id, matchday, result)
            VALUES (tournament_uuid, user_record.user_id, round_uuid, team_to_pick, 2, 'pending')
            ON CONFLICT DO NOTHING;
            
            picked_teams := array_append(picked_teams, team_to_pick);
            pick_count := pick_count + 1;
        END LOOP;
    END LOOP;
END $$;

-- Step 4: Simulate Matchday 3 picks
DO $$
DECLARE
    user_record RECORD;
    tournament_uuid UUID;
    round_uuid UUID;
    team_to_pick UUID;
    pick_count INTEGER;
    picked_teams UUID[];
    previously_picked UUID[];
BEGIN
    SELECT id INTO tournament_uuid FROM tournaments LIMIT 1;
    SELECT id INTO round_uuid FROM rounds WHERE round_number = 1 LIMIT 1;
    
    FOR user_record IN SELECT user_id FROM tournament_entries WHERE status = 'active' LOOP
        SELECT ARRAY_AGG(team_id) INTO previously_picked FROM picks WHERE user_id = user_record.user_id;
        pick_count := 0;
        picked_teams := ARRAY[]::UUID[];
        
        WHILE pick_count < 3 LOOP
            SELECT team_id INTO team_to_pick
            FROM (
                SELECT home_team_id as team_id FROM matches WHERE matchday = 3
                UNION SELECT away_team_id FROM matches WHERE matchday = 3
            ) t
            WHERE NOT (team_id = ANY(COALESCE(previously_picked, ARRAY[]::UUID[])))
              AND NOT (team_id = ANY(picked_teams))
            ORDER BY random()
            LIMIT 1;
            
            IF team_to_pick IS NULL THEN EXIT; END IF;
            
            INSERT INTO picks (tournament_id, user_id, round_id, team_id, matchday, result)
            VALUES (tournament_uuid, user_record.user_id, round_uuid, team_to_pick, 3, 'pending')
            ON CONFLICT DO NOTHING;
            
            picked_teams := array_append(picked_teams, team_to_pick);
            pick_count := pick_count + 1;
        END LOOP;
    END LOOP;
END $$;

-- Final Summary
SELECT 'SIMULATION COMPLETE' as status;
SELECT 
  'Users Created' as item, COUNT(*) as count FROM users WHERE email LIKE '%@test.com'
UNION ALL
SELECT 'Tournament Entries', COUNT(*) FROM tournament_entries
UNION ALL
SELECT 'Total Picks', COUNT(*) FROM picks
UNION ALL
SELECT 'Matchday 1 Picks', COUNT(*) FROM picks WHERE matchday = 1
UNION ALL
SELECT 'Matchday 2 Picks', COUNT(*) FROM picks WHERE matchday = 2
UNION ALL
SELECT 'Matchday 3 Picks', COUNT(*) FROM picks WHERE matchday = 3;
