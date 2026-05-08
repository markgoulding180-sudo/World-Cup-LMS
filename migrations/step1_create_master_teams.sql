-- Step 1: Create master_teams table with current team data
CREATE TABLE IF NOT EXISTS master_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  code VARCHAR(10),
  flag_url TEXT,
  group_name VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Copy current teams to master_teams
INSERT INTO master_teams (name, code, flag_url, group_name)
SELECT name, code, flag_url, group_name 
FROM teams 
ON CONFLICT (name) DO NOTHING;

-- Step 3: Verify master_teams created
SELECT COUNT(*) as master_team_count FROM master_teams;
