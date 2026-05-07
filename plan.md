# Project Plan: World Cup Last Man Standing

## What We Are Building
A Last Man Standing prediction platform for the FIFA World Cup where players pick one team per round and get eliminated if their team doesn't win.

## Tech Stack
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Styling:** Modern CSS Grid/Flexbox, responsive design
- **Theme:** Dark professional (World Cup themed - gold/navy/green)
- **Backend:** Vercel Serverless Functions (Node.js)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Hosting:** Vercel

## Database Schema

### Tables
1. **users** - Player profiles
2. **teams** - World Cup teams (name, flag, group, eliminated status)
3. **rounds** - Tournament rounds (Group Stage, R16, QF, SF, Final)
4. **picks** - User selections per round
5. **matches** - Match fixtures and results
6. **tournaments** - Game instances with entry fees/prizes

## Pages Required

### 1. Home/Landing
- Hero section with World Cup branding
- How to play explanation
- Live tournament status
- Quick stats (players, prize pool, etc.)

### 2. Login/Register
- User authentication
- Profile setup

### 3. Dashboard
- Current round status
- Available teams to pick
- My current pick
- Elimination status
- Countdown to round deadline

### 4. Leaderboard
- Players still standing
- Eliminated players (when they fell)
- Prize position indicators

### 5. Admin Panel
- Manage rounds (open/close)
- Enter match results
- View all picks
- Manage prize pool

### 6. Rules
- How to play
- Scoring explanation
- FAQ

## Game Flow

1. **Registration** - User signs up and enters tournament
2. **Round Opens** - Admin opens round for picks
3. **Pick Team** - Player selects one team for the round
4. **Deadline** - Round closes before first match
5. **Matches Play** - Games happen, results recorded
6. **Elimination** - Players with losing teams eliminated
7. **Next Round** - Surviving players pick again
8. **Repeat** - Until one player remains or final is complete

## Agent Assignments
| Agent | Role |
|-------|------|
| qwen2.5-coder:7b | All HTML, CSS, JavaScript development |
| qwen3:14b | Architecture decisions |
| gemma | Content writing, documentation |

## Success Criteria
- [ ] User registration and login
- [ ] Team picking per round
- [ ] Automatic elimination tracking
- [ ] Live leaderboard
- [ ] Admin round management
- [ ] Prize pool display
- [ ] Mobile responsive

## File Structure
```
frontend/
├── index.html
├── login.html
├── register.html
├── dashboard.html
├── leaderboard.html
├── rules.html
├── admin.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── dashboard.js
│   ├── leaderboard.js
│   └── admin.js
└── assets/
    └── images/
api/
├── login.js
├── register.js
├── picks.js
├── teams.js
├── rounds.js
├── matches.js
├── leaderboard.js
└── admin.js
```
