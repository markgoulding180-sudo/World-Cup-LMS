-- Create tournament with correct settings
INSERT INTO tournaments (name, entry_fee, max_entries, prize_pool, status)
VALUES ('World Cup 2026 Last Man Standing', 30, 100, 0, 'open')
ON CONFLICT DO NOTHING
RETURNING *;

-- Verify
SELECT * FROM tournaments;
