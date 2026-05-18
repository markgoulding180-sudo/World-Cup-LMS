-- ============================================
-- PART 2: SIMULATE MATCHDAY 1 PICKS (100 users × 3 picks each = 300 picks)
-- Each user picks 3 different teams from Matchday 1 matches
-- ============================================

DO $$
DECLARE
    user_record RECORD;
    tournament_uuid UUID;
    round_uuid UUID;
    match_record RECORD;
    available_teams UUID[];
    picked_teams UUID[];
    team_to_pick UUID;
    pick_count INTEGER;
BEGIN
    -- Get tournament and round IDs
    SELECT id INTO tournament_uuid FROM tournaments LIMIT 1;
    SELECT id INTO round_uuid FROM rounds WHERE round_number = 1 LIMIT 1;
    
    IF tournament_uuid IS NULL OR round_uuid IS NULL THEN
        RAISE EXCEPTION 'Tournament or Group Stage round not found';
    END IF;
    
    -- For each user
    FOR user_record IN SELECT user_id FROM tournament_entries WHERE status = 'active' LOOP
        
        -- Get available teams for Matchday 1 (teams playing in MD1 matches)
        SELECT ARRAY_AGG(DISTINCT team_id) INTO available_teams
        FROM (
            SELECT home_team_id as team_id FROM matches WHERE matchday = 1
            UNION
            SELECT away_team_id as team_id FROM matches WHERE matchday = 1
        ) teams;
        
        picked_teams := ARRAY[]::UUID[];
        pick_count := 0;
        
        -- Each user picks 3 teams
        WHILE pick_count < 3 AND array_length(available_teams, 1) > 0 LOOP
            -- Pick a random team not already picked
            SELECT team_id INTO team_to_pick
            FROM unnest(available_teams) AS team_id
            WHERE NOT (team_id = ANY(picked_teams))
            ORDER BY random()
            LIMIT 1;
            
            IF team_to_pick IS NOT NULL THEN
                -- Insert the pick
                INSERT INTO picks (tournament_id, user_id, round_id, team_id, matchday, result)
                VALUES (tournament_uuid, user_record.user_id, round_uuid, team_to_pick, 1, 'pending')
                ON CONFLICT DO NOTHING;
                
                picked_teams := array_append(picked_teams, team_to_pick);
                pick_count := pick_count + 1;
            ELSE
                EXIT;
            END IF;
        END LOOP;
        
    END LOOP;
    
    RAISE NOTICE 'Created Matchday 1 picks for all users';
END $$;

-- Verify picks created
SELECT 
  'Matchday 1 Picks' as check_item, 
  COUNT(*) as total_picks,
  COUNT(DISTINCT user_id) as users_with_picks
FROM picks 
WHERE matchday = 1;
