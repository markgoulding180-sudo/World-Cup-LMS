-- Simple diagnostic - run each query separately if needed

-- How many matches in each round?
SELECT r.round_number, r.name, COUNT(m.id) as matches
FROM rounds r
LEFT JOIN matches m ON m.round_id = r.id
GROUP BY r.id, r.round_number, r.name
ORDER BY r.round_number;
