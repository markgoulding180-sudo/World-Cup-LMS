-- ============================================
-- SIMULATE KNOCKOUT STAGES FROM GROUP STAGE RESULTS
-- This script runs after Matchday 3 results are entered
-- ============================================

-- Step 1: Calculate group standings from match results
-- 3 points for win, 1 for draw, 0 for loss

WITH group_standings AS (
  SELECT 
    t.id as team_id,
    t.name as team_name,
    t.group_name,
    COUNT(m.id) as played,
    SUM(CASE 
      WHEN (m.home_team_id = t.id AND m.result = 'H') OR (m.away_team_id = t.id AND m.result = 'A') THEN 3
      WHEN m.result = 'D' THEN 1
      ELSE 0
    END) as points,
    SUM(CASE 
      WHEN (m.home_team_id = t.id AND m.result = 'H') OR (m.away_team_id = t.id AND m.result = 'A') THEN 1
      ELSE 0
    END) as wins
  FROM teams t
  LEFT JOIN matches m ON (t.id = m.home_team_id OR t.id = m.away_team_id)
    AND m.status = 'finished'
    AND m.matchday IN (1, 2, 3)
  GROUP BY t.id, t.name, t.group_name
),

-- Step 2: Rank teams within each group
ranked_teams AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (PARTITION BY group_name ORDER BY points DESC, wins DESC) as group_rank
  FROM group_standings
)

-- Step 3: Select top 2 from each group (24 teams total for Round of 32)
-- Note: World Cup 2026 has 12 groups, top 2 = 24 teams
-- Plus 8 best 3rd place teams = 32 total for Round of 32
SELECT 
  team_id,
  team_name,
  group_name,
  points,
  group_rank,
  CASE 
    WHEN group_rank <= 2 THEN 'Qualified for Round of 32'
    ELSE 'Eliminated'
  END as status
FROM ranked_teams
ORDER BY group_name, group_rank;

-- ============================================
-- To use this in the simulation:
-- 1. Run this query to see standings
-- 2. Create Round of 32 matches using qualified teams
-- 3. Continue simulation
-- ============================================
