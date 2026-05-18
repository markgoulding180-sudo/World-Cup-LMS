-- Fix existing entries to have 5 lives
UPDATE tournament_entries 
SET lives_remaining = 5, max_lives = 5
WHERE status = 'active';

-- Verify
SELECT user_id, lives_remaining, max_lives, status 
FROM tournament_entries 
LIMIT 5;
