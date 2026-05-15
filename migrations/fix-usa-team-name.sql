-- Migration: Fix USA team name in master_teams to match fixturedownload.com
-- fixturedownload.com uses "United States" not "USA"

UPDATE master_teams 
SET name = 'United States' 
WHERE name = 'USA';

-- Verify the change
SELECT name, code, group_name FROM master_teams WHERE code = 'USA';
