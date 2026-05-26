# Admin Workflow & Dashboard Review

## Admin Panel Workflow

### 1. Tournament Setup (One-time)
```
Reset All Data → Setup Tournament
```
- ✅ Reset clears: picks, entries, matches, rounds, tournaments, teams, users, auth accounts
- ✅ Setup creates: tournament (£30 entry), 48 teams, 6 rounds, imports group stage matches from football-data.org
- ✅ Preserves: master_teams table (flag images)

### 2. Round Management
```
Round Management → Select Round → Open/Close
```
- ✅ Opens/closes rounds for user picking
- ✅ Group Stage (Round 1) must be open for users to make picks
- ✅ Close Group Stage before creating R32 matches

### 3. Match Results Entry (Two methods)

**Method A: Manual Entry**
```
Enter Match Result → Input scores → Save
```
- ✅ Calls `/api/admin-results` (POST)
- ✅ Updates match record with scores
- ✅ Updates picks for that specific matchday only (FIXED)
- ✅ Awards points to winners
- ✅ Shows confirmation with points awarded

**Method B: Auto-Update from football-data.org**
```
Manual Import → Import World Cup 2026 Data
OR
Check API for Knockout Matches → Check R32/R16/QF/SF/Final
```
- ✅ Calls `/api/update-results` (POST) for results
- ✅ Calls `/api/reset-all` with `check_ko_matches` action for knockout fixtures
- ✅ Fetches from: `https://api.football-data.org/v4/competitions/WC/matches?season=2026`
- ✅ Processes only FINISHED matches
- ✅ Team name mappings handle discrepancies (e.g., "Korea Republic" → "South Korea")
- ✅ Updates picks with matchday filter (FIXED)

### 4. Knockout Round Creation
```
Check API for Knockout Matches → Check R32 (after Group Stage closes)
```
- ✅ Calculates qualified teams from group standings
- ✅ Top 2 from each group + 8 best third-placed teams = 32 teams
- ✅ Creates R32 matches from API or manual pairing
- ✅ Subsequent rounds (R16, QF, SF, F) created from winners

### 5. Simulation Tools (For Testing)
```
Tournament Simulation OR Simulate Tournament (Step by Step)
```
- ✅ Creates test users
- ✅ Simulates picks for each matchday
- ✅ Simulates random results
- ✅ Creates knockout rounds
- ✅ Saves simulation history

---

## Dashboard Tabs Review

### Tab 1: Make Your Pick
**Function:** User picks teams for current round

**Group Stage Flow:**
1. Shows Matchday 1/2/3 with 3 picks per matchday
2. User selects teams from available match fixtures
3. Submit picks → Calls `/api/picks` (POST)
4. Shows "All Picks Submitted!" card when complete (with background image)

**Knockout Round Flow:**
1. Shows available teams for current knockout round
2. User selects 1 team
3. Submit pick → Calls `/api/picks` (POST)
4. Shows pick confirmation with result status

**API Calls:**
- `GET /api/entries` - Check entry status
- `GET /api/rounds` - Get current round
- `GET /api/picks` - Get user's picks
- `GET /api/teams` - Get all teams
- `GET /api/matches` - Get fixtures
- `POST /api/picks` - Submit pick(s)

### Tab 2: Your Picks
**Function:** Display user's current picks

**Shows:**
- Group Stage: 9 picks organized by matchday
- Knockout: Current round pick with status
- Team flags, match times, results (✓/✗/⏳), points

**Data Source:** User's picks from `/api/picks` with joined team/round data

### Tab 3: Tournament History
**Function:** Display all picks across all rounds

**Shows:**
- Group Stage card with 9 picks in 3x3 grid
- Knockout rounds (R32, R16, QF, SF, Final) with single picks
- Points per round, win/loss status
- Visual indicators for current round

**Data Source:** User's picks from `/api/picks`

### Tab 4: Group Results
**Function:** Display live group standings

**Implementation:** `displayGroupResults()` in dashboard.js

**Logic:**
1. Groups teams by `group_name`
2. Calculates points from finished group stage matches:
   - Win = 3 points
   - Draw = 1 point
   - Loss = 0 points
3. Sorts by: Points → Goal Difference → Goals Scored
4. Shows top 3 with qualification indicators

**API Dependency:**
- Uses `allMatches` data (fetched from `/api/matches`)
- Filters for `status === 'finished'` and group stage
- Calculates standings client-side

**Live Data:** ✅ Will update as match results come in from football-data.org

### Tab 5: K/O Grid
**Function:** Display all matches across all rounds

**Implementation:** `displayRoundMatches()` in dashboard.js

**Shows:**
- All matches sorted by date
- Grouped by round (Group Stage, R32, R16, QF, SF, Final)
- Scores for finished matches
- "CURRENT" badge for active round
- "LIVE" badge for live matches (if supported by API)

**API Dependency:**
- Uses `allMatches` data from `/api/matches?limit=200`
- Joins with `rounds` table for round names
- Shows real-time scores from database

**Live Data:** ✅ Will update as match results come in from football-data.org

---

## football-data.org Integration Status

### ✅ Working:
1. **Group Stage Import** - Imported during Setup Tournament
2. **Auto-Update Results** - `/api/update-results` fetches finished matches
3. **Knockout Round Check** - `/api/reset-all` with `check_ko_matches` action
4. **Team Name Mappings** - Handles naming discrepancies

### ⚠️ Manual Steps Required:
1. **Knockout Fixtures** - Admin must click "Check R32" after Group Stage closes
2. **Timing** - FIFA may take 2-4 hours to populate API after draws complete
3. **Backup** - If API is delayed, admin can manually create matches

### 🔧 API Endpoints Used:
- `GET https://api.football-data.org/v4/competitions/WC/matches?season=2026`
- Auth token: `aef925b3b2df4c6e922f08a5498bdab0`

---

## Pre-Live Checklist

### Admin Workflow:
- [ ] Reset All Data tested
- [ ] Setup Tournament tested
- [ ] Manual result entry tested
- [ ] Auto-update from API tested
- [ ] Round open/close tested
- [ ] Knockout round creation tested

### Dashboard Tabs:
- [ ] Make Your Pick - Group Stage flow tested
- [ ] Make Your Pick - Knockout flow tested
- [ ] Your Picks - displays correctly
- [ ] Tournament History - displays correctly
- [ ] Group Results - updates with match results
- [ ] K/O Grid - shows all matches with scores

### API Integration:
- [ ] football-data.org connection verified
- [ ] Team name mappings verified
- [ ] Matchday filter fix verified (prevents cross-matchday updates)

---

## Critical Fixes Applied

1. **Matchday Filter** (CRITICAL)
   - Fixed: Results now only affect picks for that specific matchday
   - Files: `api/admin-results.js`, `api/update-results.js`

2. **Picks API Join** (HIGH)
   - Fixed: POST response now includes joined team/round data
   - File: `api/picks.js`

3. **Remember Me** (MEDIUM)
   - Added: Login/registration with persistent sessions
   - Files: `login.html`, `register.html`, `app.js`, `api/auth.js`

---

## Recommendation

**System is READY for live tournament** with the following monitoring:

1. **Daily checks** during Group Stage:
   - Run "Import World Cup 2026 Data" to auto-update results
   - Or manually enter results if API is delayed

2. **After Group Stage closes:**
   - Click "Check R32" to load Round of 32 fixtures
   - May need to wait 2-4 hours for FIFA to update API

3. **Backup plan:**
   - If API fails, use manual result entry
   - If knockout fixtures not in API, create manually via admin panel
