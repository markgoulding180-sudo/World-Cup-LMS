## GitHub
Repo: https://github.com/markgoulding180-sudo/World-Cup-LMS
Created: 2026-05-07

## Setup Required

### 1. Supabase
- Create new project at supabase.com
- Run `supabase-schema.sql` in SQL Editor
- Copy Project URL and API keys

### 2. Vercel
- Import from GitHub: https://github.com/markgoulding180-sudo/World-Cup-LMS
- Set environment variables:
  - SUPABASE_URL
  - SUPABASE_KEY  
  - SUPABASE_SECRET

### 3. Update Frontend
- Edit `frontend/js/app.js` with your Supabase credentials
- Commit and push

## Project Structure
- Frontend: HTML/CSS/JS in `frontend/`
- API: Serverless functions in `api/`
- Database: Supabase PostgreSQL

## Development Log

### 2026-05-08 04:44 - Structured 3-Step Matchday Pick Flow
**Implemented:**
- Updated `dashboard.js` with new `displayMatchdayPickFlow()` function
- Added matchday tracking (1, 2, 3) for Group Stage
- Auto-advances to next matchday after 3 picks
- Shows matchday progress bar and status
- Teams displayed by matchday with clickable flags
- Prevents duplicate team picks across all matchdays
- Added comprehensive CSS styles for matchday UI

**Database migrations added:**
- `add-matchday-columns.sql` - Adds matchday column to matches and picks tables
- `allow-multiple-picks.sql` - Removes unique constraint to allow 3 picks per matchday

**Files changed:**
- `frontend/js/dashboard.js` - Complete rewrite for matchday flow
- `frontend/css/style.css` - Added matchday UI styles
- `api/picks.js` - Already had matchday support

**Commit:** `d66ba92` - Implement structured 3-step matchday pick flow for Group Stage
