-- ============================================
-- PART 4: SIMULATE MATCHDAY 3 PICKS
-- ============================================

DO $$
DECLARE
    user_record RECORD;
    tournament_uuid UUID;
    round_uuid UUID;
    available_teams UUID[];
    picked_teams UUID[];
    previously_picked UUID[];
    team_to_pick UUID;
    pick_count INTEGER;
BEGIN
    SELECT id INTO tournament_uuid FROM tournaments LIMIT 1;
    SELECT id INTO round_uuid FROM rounds WHERE round_number = 1 LIMIT 1;
    
    FOR user_record IN 
        SELECT te.user_id 
        FROM tournament_entries te
        WHERE te.status = 'active' AND te.lives_remaining > 0
    LOOP
        SELECT ARRAY_AGG(team_id) INTO previously_picked
        FROM picks
        WHERE user_id = user_record.user_id;
        
        SELECT ARRAY_AGG(DISTINCT team_id) INTO available_teams
        FROM (
            SELECT home_team_id as team_id FROM matches WHERE matchday = 3
            UNION
            SELECT away_team_id as team_id FROM matches WHERE matchday = 3
        ) teams
        WHERE NOT (team_id = ANY(COALESCE(previously_picked, ARRAY[]::UUID[])));
        
        picked_teams := ARRAY[]::UUID[];
        pick_count := 0;
        
        WHILE pick_count < 3 AND array_length(available_teams, 1) > 0 LOOP
            SELECT team_id INTO team_to_pick
            FROM unnest(available_teams) AS team_id
            WHERE NOT (team_id = ANY(picked_teams))
            ORDER BY random()
            LIMIT 1;
            
            IF team_to_pick IS NOT NULL THEN
                INSERT INTO picks (tournament_id, user_id, round_id, team_id, matchday, result)
                VALUES (tournament_uuid, user_record.user_id, round_uuid, team_to_pick, 3, 'pending')
                ON CONFLICT DO NOTHING;
                
                picked_teams := array_append(picked_teams, team_to_pick);
                pick_count := pick_count + 1;
            ELSE
                EXIT;
            END IF;
        END LOOP;
        
    END LOOP;
    
    RAISE NOTICE 'Created Matchday 3 picks';
END $$;

SELECT 
  'Matchday 3 Picks' as check_item, 
  COUNT(*) as total_picks,
  COUNT(DISTINCT user_id) as users_with_picks
FROM picks 
WHERE matchday = 3;
