-- World Cup Last Man Standing Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(20) UNIQUE NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  total_wins INTEGER DEFAULT 0,
  total_games INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table (World Cup teams)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  code VARCHAR(3) UNIQUE NOT NULL,
  group_name VARCHAR(1) NOT NULL,
  flag_url TEXT,
  eliminated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rounds table (tournament rounds)
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  round_number INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'upcoming', -- upcoming, open, closed, finished
  opens_at TIMESTAMP WITH TIME ZONE,
  closes_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournaments table
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  entry_fee INTEGER DEFAULT 0,
  prize_pool INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'upcoming', -- upcoming, live, finished
  max_players INTEGER,
  current_players INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament entries
CREATE TABLE tournament_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active', -- active, eliminated, winner
  eliminated_at TIMESTAMP WITH TIME ZONE,
  eliminated_round INTEGER,
  final_position INTEGER,
  entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- Picks table (user selections per round)
CREATE TABLE picks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  result VARCHAR(20), -- win, loss, draw, pending
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, user_id, round_id)
);

-- Matches table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  home_score INTEGER,
  away_score INTEGER,
  result VARCHAR(1), -- H, D, A
  match_time TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'upcoming', -- upcoming, live, finished
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Master clock for current round
CREATE TABLE master_clock (
  id VARCHAR(10) PRIMARY KEY,
  current_round INTEGER NOT NULL,
  tournament_id UUID REFERENCES tournaments(id),
  status VARCHAR(20) DEFAULT 'active',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Anyone can read teams" ON teams FOR SELECT USING (true);

CREATE POLICY "Anyone can read rounds" ON rounds FOR SELECT USING (true);

CREATE POLICY "Anyone can read tournaments" ON tournaments FOR SELECT USING (true);

CREATE POLICY "Users can read own entries" ON tournament_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own entry" ON tournament_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own picks" ON picks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pick" ON picks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read matches" ON matches FOR SELECT USING (true);

-- Indexes
CREATE INDEX idx_teams_group ON teams(group_name);
CREATE INDEX idx_picks_tournament ON picks(tournament_id);
CREATE INDEX idx_picks_user ON picks(user_id);
CREATE INDEX idx_picks_round ON picks(round_id);
CREATE INDEX idx_entries_tournament ON tournament_entries(tournament_id);
CREATE INDEX idx_entries_user ON tournament_entries(user_id);
CREATE INDEX idx_matches_round ON matches(round_id);
