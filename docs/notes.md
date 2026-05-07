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
