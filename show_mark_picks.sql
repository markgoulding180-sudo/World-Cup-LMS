-- Update tournament to 5 lives
UPDATE tournaments 
SET lives = 5 
WHERE name = 'World Cup 2026 Last Man Standing';

-- Verify
SELECT name, lives, max_players, entry_fee FROM tournaments;
