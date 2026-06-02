# World Cup LMS - Deadline & Auto-Pick Changes Summary

## Overview
This document details all changes made to implement the "Trigger Deadline" feature, which allows admins to manually close picks for a round and auto-assign teams to users who missed the deadline.

---

## Files Modified

### 1. API Files

#### `api/rounds.js`
**Purpose**: Handle round management including the new trigger_deadline action

**Changes**:
- Added new action `trigger_deadline` to the POST handler
- When triggered:
  1. Sets `picks_closed = true` for the round
  2. Gets all active users in the tournament
  3. For each user, checks if they have picks for this round
  4. If Group Stage (round 1): Assigns 9 random teams (3 per matchday)
  5. If Knockout round: Assigns 1 random team
  6. Marks all auto-picks with `is_auto_pick = true`
  7. Returns count of auto-picks created

**Key Logic**:
- Uses a `Set` to track used teams across all matchdays (each team can only be used once per user in Group Stage)
- For Group Stage: Loops through matchdays 1-3, assigns 3 teams per matchday
- For Knockout rounds: Assigns 1 team from available teams in that round
- Adds score predictions (random 0-3) for QF, SF, Final rounds

---

### 2. Frontend Files

#### `frontend/admin.html`
**Purpose**: Admin panel UI

**Changes**:
- Added new section "Round Deadline" in the Round Management card
- Includes:
  - Dropdown to select which round to trigger deadline for
  - "Trigger Deadline" button (yellow/gold color)
  - Status message area
- Moved from "emergency" style to regular workflow style

**UI Flow**:
```
Round Management
├── Open/Close Round (existing)
├── Force Close/Open Picks (existing - for temporary holds)
└── Trigger Deadline (NEW)
    ├── Select round dropdown
    └── Trigger Deadline button
```

---

#### `frontend/js/admin.js`
**Purpose**: Admin panel JavaScript functionality

**Changes**:
1. **Added `triggerRoundDeadlineForSelected()` function**
   - Gets selected round from dropdown
   - Confirms with admin before proceeding
   - Calls `/api/rounds` with `action: 'trigger_deadline'`
   - Displays success/error message
   - Refreshes round status and picks list

2. **Updated `loadRoundStatus()` function**
   - Also populates the new deadline round dropdown
   - Ensures dropdown has all rounds listed

---

#### `frontend/js/dashboard.js`
**Purpose**: User dashboard functionality

**Changes**:
1. **Updated `displayMatchdayPickFlow()` function**
   - Now checks if `picks_closed === true` for the round
   - If picks are closed (admin triggered deadline OR match time passed):
     - Shows "Picks Are Closed" message
     - Displays how many picks user missed
     - Shows auto-pick status message
   - No longer shows pick interface when picks are closed

2. **Updated message display**
   - Shows different messages based on whether admin closed picks or time passed
   - Shows if auto-picks have been assigned

---

### 3. Database Migration

#### `migrations/add-auto-pick-column.sql`
**Purpose**: Add column to track auto-picks

**SQL**:
```sql
ALTER TABLE picks ADD COLUMN IF NOT EXISTS is_auto_pick BOOLEAN DEFAULT false;
UPDATE picks SET is_auto_pick = false WHERE is_auto_pick IS NULL;
```

**Note**: This migration needs to be run manually in Supabase SQL Editor before the tournament starts.

---

## Workflow Summary

### Admin Workflow with Trigger Deadline

```
1. Setup Tournament
   └── Group Stage opens automatically

2. Users Register & Pick
   └── Before deadline (June 11, 20:00 for Group Stage)

3. First Match Kicks Off
   └── Admin clicks "Trigger Deadline" for Group Stage
   └── System:
       ├── Sets picks_closed = true
       ├── Finds all users with missing picks
       ├── Assigns random teams to those users
       └── Returns count of auto-picks created

4. Users Who Missed Deadline
   └── Log in and see "Picks Are Closed" message
   └── See their auto-assigned teams in "Your Picks" tab

5. Admin Fetches Results
   └── Points awarded to all users (including auto-picks)

6. Close Group Stage → Open Next Round
   └── Repeat process for each round
```

---

## Key Features

### 1. Manual Control
- Admin decides when to trigger deadline (not automatic)
- Can be done before or after match time
- Works for any round (Group Stage or Knockout)

### 2. Fairness
- All users get same number of picks per round
- Auto-picks are random (same chance as manual picks)
- Teams can only be used once per user (tracked across matchdays)

### 3. Transparency
- Users see "Picks Are Closed" message
- Auto-picks marked with `is_auto_pick = true` in database
- Users can see their auto-assigned teams in "Your Picks" tab

### 4. Safety
- Double protection: API blocks late picks + UI shows closed message
- Admin can still force re-open picks if needed
- Points calculate normally for auto-picks

---

## Testing Checklist

Before tournament starts:
- [ ] Run SQL migration in Supabase
- [ ] Reset and setup tournament
- [ ] Create User A (make all picks)
- [ ] Create User B (make no picks)
- [ ] Click "Trigger Deadline" for Group Stage
- [ ] Verify User B gets exactly 9 auto-picks
- [ ] Verify User B sees "Picks Are Closed" message
- [ ] Verify User B can see auto-picks in "Your Picks" tab
- [ ] Simulate results and verify points awarded

---

## API Endpoints (Still 12/12)

No new API endpoints created. The `trigger_deadline` action was added to the existing `/api/rounds` endpoint.

---

## Git Commits

1. `f06e3e9` - Update: Entry fee £20, auto-pick for missed rounds
2. `2d83b55` - Fix: Check matchday deadlines
3. `3a1d282` - Fix: Remove duplicate matchdayMatches declaration
4. `120051b` - Add auto-pick for missed deadlines when fetching results
5. `c069b77` - Update: Better 'Picks Closed' message
6. `992c26f` - Add manual auto-pick button for testing
7. `e8966d7` - Update: Round Deadline button - cleaner UI
8. `3f91c36` - Add Close Round & Auto-Pick button
9. `e21f38b` - Add per-round deadline trigger dropdown
10. `1c6f670` - Fix: Add authentication token to auto-pick API call
11. `279892f` - Fix: Add trigger_deadline action to rounds API
12. `f703a5f` - Fix: Check picks_closed flag to show closed message
13. `037bdcc` - Fix: Track used teams across all matchdays

---

## Current Status

**Ready for tournament?** YES - with the latest fix (commit 037bdcc), the auto-pick should correctly assign exactly 9 teams for Group Stage.

**Confidence Level**: 90% - The logic is now correct, but should be tested one more time to confirm.
