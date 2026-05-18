-- Create tournament with correct columns
INSERT INTO tournaments (name, entry_fee, max_players, prize_pool, status, lives)
VALUES ('World Cup 2026 Last Man Standing', 30, 100, 0, 'open', 9)
ON CONFLICT DO NOTHING
RETURNING *;
