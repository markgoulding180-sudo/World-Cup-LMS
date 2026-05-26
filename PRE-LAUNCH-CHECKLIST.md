# LMS Live Tournament - Pre-Launch Checklist

## ✅ System Components Verified

### 1. Database Schema
- [x] `tournaments` table - stores tournament config
- [x] `rounds` table - 6 rounds (GS, R32, R16, QF, SF, F)
- [x] `teams` table - 48 teams with flags, codes, groups
- [x] `matches` table - fixtures with scores, results
- [x] `picks` table - user picks with result, points
- [x] `tournament_entries` table - user entries with total_points, wins
- [x] `users` table - auth profiles
- [x] `simulations` table - simulation history

### 2. API Endpoints
- [x] `GET/POST /api/picks` - User picks (FIXED: returns joined team/round data)
- [x] `GET/POST /api/entries` - Tournament entry
- [x] `GET /api/leaderboard` - Rankings with stats
- [x] `GET /api/matches` - Fixtures + qualified teams calc
- [x] `GET/POST /api/rounds` - Round management
- [x] `POST /api/admin-results` - Manual result entry
- [x] `POST /api/update-results` - Auto-update from football-data.org
- [x] `POST /api/reset-all` - Admin reset/setup/simulation

### 3. Frontend Pages
- [x] `index.html` - Landing page
- [x] `login.html` / `register.html` - Auth
- [x] `dashboard.html` - User dashboard with picks
- [x] `leaderboard.html` - Live rankings
- [x] `admin.html` - Admin panel
- [x] `rules.html` - Game rules

### 4. Points System
- [x] Group Stage: 2 points per win
- [x] Round of 32: 4 points per win
- [x] Round of 16: 6 points per win
- [x] Quarter Finals: 8 points per win
- [x] Semi Finals: 10 points per win
- [x] Final: 15 points per win

### 5. Game Rules Enforced
- [x] Team can only be used ONCE per tournament
- [x] Group Stage: 3 picks per matchday (9 total)
- [x] Knockout: 1 pick per round
- [x] No elimination - all players participate through Final
- [x] Winner = highest total points
- [x] Tiebreaker: most wins, then earliest entry

---

## 🧪 Manual Test Procedure

### Test 1: Fresh Setup
```bash
# Admin Panel > Reset & Setup
1. Click "Reset All Data" (confirm: RESET)
2. Click "Setup Tournament"
3. Verify: 48 teams, 6 rounds, 144 group matches loaded
```

### Test 2: User Registration
```bash
# As a new user:
1. Register at /register.html
2. Login at /login.html
3. Click "Enter Tournament (£30)"
4. Verify entry appears on dashboard
```

### Test 3: Group Stage Picks
```bash
# Dashboard > Make Your Pick
1. Select 3 teams for Matchday 1
2. Click Submit
3. Verify "Your Picks" shows 3 picks with team names/flags
4. Verify "Tournament History" shows Matchday 1 picks
```

### Test 4: Admin Result Entry
```bash
# Admin Panel > Match Results
1. Enter scores for a Matchday 1 match
2. Click Save
3. Verify pick results update (win/loss)
4. Verify points awarded (2 pts for wins)
5. Verify leaderboard updates
```

### Test 5: Auto-Update from API
```bash
# Admin Panel > Auto-Update Results
1. Click "Update from football-data.org"
2. Verify finished matches are processed
3. Verify points awarded correctly
```

### Test 6: Round Transition
```bash
# Admin Panel > Round Management
1. Close Group Stage
2. Click "Create R32 Matches" (or "Check KO Matches" to auto-import)
3. Verify 32 teams qualified, 16 matches created
4. Open Round of 32
5. User dashboard should show R32 pick flow
```

### Test 7: Knockout Picks
```bash
# Dashboard (R32 open)
1. Select 1 team for R32
2. Verify team choice is from qualified teams only
3. Submit pick
4. Verify "Your Picks" shows R32 pick
```

### Test 8: Full Tournament Flow
```bash
# Run full simulation:
Admin Panel > Simulation > Run Full Simulation
1. Verify all 6 rounds complete
2. Verify winner has correct total points
3. Verify leaderboard sorted correctly
4. Check simulation history saved
```

---

## ⚠️ Known Limitations

1. **Payment**: £30 entry fee is tracked but NOT collected (no Stripe/PayPal)
   - Workaround: Manual payment collection outside system

2. **Knockout Fixture Import**: FIFA may delay populating teams in API
   - Workaround: Use "Check KO Matches" button after draw announced
   - Fallback: Manual match creation in admin

3. **Email**: No email notifications for results/round opens
   - Workaround: Manual communication (WhatsApp/email outside system)

---

## 🚀 Go-Live Readiness

**READY FOR LIVE USE** if:
- [ ] Admin understands knockout round import process
- [ ] Payment collection handled externally
- [ ] Test simulation completed successfully
- [ ] User acceptance testing done

**RECOMMENDATION**: Run one full simulation first to verify all components work together.
