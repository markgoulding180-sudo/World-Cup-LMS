-- Fix entry fee to £30
UPDATE tournaments 
SET entry_fee = 30 
WHERE name = 'World Cup 2026 Last Man Standing';

-- Verify
SELECT name, entry_fee, max_players, status FROM tournaments;
