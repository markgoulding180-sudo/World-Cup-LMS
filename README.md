# World Cup Last Man Standing

A Last Man Standing prediction game for the FIFA World Cup.

## How to Play
1. Enter the tournament
2. Pick one team to win each round
3. If your team wins, you advance
4. If your team loses or draws, you're eliminated
5. Last player standing wins the pot!

## Tech Stack
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Vercel Serverless Functions
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth
- Hosting: Vercel

## Setup Instructions

### 1. Supabase Setup
- Create new Supabase project
- Run `supabase-schema.sql` in SQL Editor
- Get project URL and anon key

### 2. Vercel Setup
- Connect GitHub repo to Vercel
- Set environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_KEY`
  - `SUPABASE_SECRET`

### 3. Deploy
- Push to GitHub
- Vercel auto-deploys

## Environment Variables
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SECRET=your_supabase_service_role_key
```
