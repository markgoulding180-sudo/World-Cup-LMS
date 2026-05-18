-- Debug: Find all matches and their round associations

-- 1. How many total matches in the database?
SELECT 'Total matches' as info, COUNT(*) as count FROM matches;

-- 2. How many matches per round?
SELECT 'Matches per round' as info, r.round_number, r.name, COUNT(m.id) as match_count
FROM rounds r
LEFT JOIN matches m ON m.round_id = r.id
GROUP BY r.id, r.round_number, r.name
ORDER BY r.round_number;

-- 3. Are there matches with round_id that doesn't exist in rounds table?
SELECT 'Orphaned matches' as info, COUNT(*) as count 
FROM matches m
WHERE NOT EXISTS (SELECT 1 FROM rounds r WHERE r.id = m.round_id);

-- 4. Show sample of matches without matchday
SELECT 'Sample matches without matchday' as info, m.id, m.match_time, r.round_number, r.name
FROM matches m
JOIN rounds r ON m.round_id = r.id
WHERE m.matchday IS NULL
LIMIT 10;

-- 5. Count matches without matchday by round
SELECT 'Matches without matchday by round' as info, r.round_number, COUNT(*) as count
FROM matches m
JOIN rounds r ON m.round_id = r.id
WHERE m.matchday IS NULL
GROUP BY r.round_number;
