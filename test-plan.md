# LMS End-to-End Test Script

## Test Plan

### Phase 1: Setup
1. Reset all data
2. Setup tournament (import teams, rounds, matches from football-data.org)
3. Verify group stage matches loaded

### Phase 2: User Registration & Entry
4. Create test users (simulation)
5. Verify users can enter tournament
6. Check entries are recorded

### Phase 3: Group Stage
7. Open Group Stage round
8. Make picks for Matchday 1
9. Submit results for Matchday 1
10. Verify points awarded
11. Repeat for Matchdays 2 & 3

### Phase 4: Knockout Stage
12. Close Group Stage, open R32
13. Create R32 matches (qualified teams)
14. Make R32 picks
15. Submit R32 results
16. Verify points awarded (4 pts for R32 wins)
17. Repeat for R16, QF, SF, Final

### Phase 5: Verification
18. Check final leaderboard
19. Verify winner has correct total points
20. Check all picks display correctly

## API Endpoints to Test

```bash
# Setup
POST /api/reset-all {action: "reset", confirm: "RESET", admin_pin: "1234"}
POST /api/reset-all {action: "setup", admin_pin: "1234"}

# User simulation
POST /api/reset-all {action: "simulate_users", batch: 0, admin_pin: "1234"}

# Round management
POST /api/rounds {action: "open", round_id: "..."}
POST /api/rounds {action: "close", round_id: "..."}

# Picks & Results
POST /api/picks {team_id, round_id, tournament_id, matchday}
POST /api/admin-results {match_id, home_score, away_score}

# Data retrieval
GET /api/entries
GET /api/picks
GET /api/leaderboard
GET /api/matches
```

## Expected Behavior

- Group Stage: 9 picks per user (3 per matchday), 2 points per win
- R32: 1 pick per user, 4 points per win
- R16: 1 pick per user, 6 points per win
- QF: 1 pick per user, 8 points per win
- SF: 1 pick per user, 10 points per win
- Final: 1 pick per user, 15 points per win

- Leaderboard updates after each result
- Users eliminated if they run out of eligible teams
- Team uniqueness enforced across entire tournament
