# World Cup Last Man Standing

## Project Brief
A Last Man Standing prediction game for the FIFA World Cup.

## Core Concept
- Players pick one team to win each round
- If your team wins, you advance to next round
- If your team loses or draws, you're eliminated
- Last player standing wins the pot

## Features
- User registration and authentication
- Team selection per round
- Live match results
- Elimination tracking
- Leaderboard
- Admin panel for managing rounds

## Tech Stack
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Vercel Serverless Functions
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth
- Hosting: Vercel

## Pages
1. Home/Landing
2. Login/Register
3. Dashboard (current round, pick team)
4. Leaderboard
5. Admin Panel
6. Rules/How to Play

## Database Tables
- users
- teams
- rounds
- picks
- matches
- tournaments

## Scoring
- Win = Advance
- Draw/Loss = Eliminated
