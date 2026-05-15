-- ============================================
-- PART 5: SIMULATE KNOCKOUT STAGE PICKS
-- Round of 32, Round of 16, Quarter Finals, Semi Finals, Final
-- 1 pick per round for surviving users
-- ============================================

DO $$
DECLARE
    user_record RECORD;
    tournament_uuid UUID;
    round_record RECORD;
    available_teams UUID[];
    previously_picked UUID[];
    team_to_pick UUID;
BEGIN
    SELECT id INTO tournament_uuid FROM tournaments LIMIT 1;
    
    -- For each knockout round (2-6)
    FOR round_record IN 
        SELECT id, round_number, name 
        FROM rounds 
        WHERE round_number >= 2 
        ORDER BY round_number
    LOOP
        
        -- For each active user
        FOR user_record IN 
            SELECT te.user_id 
            FROM tournament_entries te
            WHERE te.status = 'active' AND te.lives_remaining > 0
        LOOP
            -- Get all previously picked teams
            SELECT ARRAY_AGG(team_id) INTO previously_picked
            FROM picks
            WHERE user_id = user_record.user_id;
            
            -- Get available teams for this round (not previously picked)
            SELECT ARRAY_AGG(DISTINCT team_id) INTO available_teams
            FROM (
                SELECT home_team_id as team_id FROM matches WHERE round_id = round_record.id
                UNION
                SELECT away_team_id as team_id FROM matches WHERE round_id = round_record.id
            ) teams
            WHERE NOT (team_id = ANY(COALESCE(previously_picked, ARRAY[]::UUID[])));
            
            -- Pick 1 team for this round
            IF array_length(available_teams, 1) > 0 THEN
                SELECT team_id INTO team_to_pick
                FROM unnest(available_teams) AS team_id
                ORDER BY random()
                LIMIT 1;
                
                IF team_to_pick IS NOT NULL THEN
                    INSERT INTO picks (tournament_id, user_id, round_id, team_id, matchday, result)
                    VALUES (tournament_uuid, user_record.user_id, round_record.id, team_to_pick, NULL, 'pending')
                    ON CONFLICT DO NOTHING;
                END IF;
            END IF;
            
        END LOOP;
        
        RAISE NOTICE 'Created picks for %', round_record.name;
    END LOOP;
    
END $$;

-- Verify all picks
SELECT 
  r.name as round,
  COUNT(*) as total_picks,
  COUNT(DISTINCT p.user_id) as users_with_picks
FROM picks p
JOIN rounds r ON p.round_id = r.id
GROUP BY r.round_number, r.name
ORDER BY r.round_number;
