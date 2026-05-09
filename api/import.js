// Vercel Function: Import from fixturedownload.com - v5
// Uses fixturedownload API and maps to existing teams table
const { createClient } = require('@supabase/supabase-js');

const FIXTURE_URL = 'https://fixturedownload.com/feed/json/fifa-world-cup-2026';

// Team name mappings (fixturedownload -> your naming)
const TEAM_MAPPINGS = {
  'Korea Republic': 'South Korea',
  'Czechia': 'Czech Republic',
  'IR Iran': 'Iran',
  'Türkiye': 'Turkey',
  'Congo DR': 'DR Congo',
  'Cabo Verde': 'Cape Verde',
  "Côte d'Ivoire": 'Ivory Coast',
  'USA': 'United States',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina'
};

const ROUNDS = [
  { name: 'Group Stage', round_number: 1, picks_required: 9 },
  { name: 'Round of 32', round_number: 2, picks_required: 1 },
  { name: 'Round of 16', round_number: 3, picks_required: 1 },
  { name: 'Quarter Finals', round_number: 4, picks_required: 1 },
  { name: 'Semi Finals', round_number: 5, picks_required: 1 },
  { name: 'Final', round_number: 6, picks_required: 1 }
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET
  );

  // SETUP - Import rounds and matches from fixturedownload
  if (action === 'setup') {
    try {
      // 1. Fetch from fixturedownload
      const response = await fetch(FIXTURE_URL);
      const fixtures = await response.json();
      
      // Filter group stage only (RoundNumber 1-3)
      const groupStage = fixtures.filter(f => f.RoundNumber >= 1 && f.RoundNumber <= 3);
      
      // 2. Get existing teams from teams table
      const { data: existingTeams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, code, flag_url, group_name');
      
      if (teamsError) throw teamsError;
      
      // Create team lookup by name
      const teamLookup = new Map(existingTeams?.map(t => [t.name, t.id]));
      
      // Also create lookup by code for fallback matching
      const teamLookupByCode = new Map(existingTeams?.map(t => [t.code, t.id]));
      
      // 3. Create rounds (if not exist)
      const { data: existingRounds } = await supabase.from('rounds').select('round_number');
      const existingRoundNumbers = new Set(existingRounds?.map(r => r.round_number) || []);
      const newRounds = ROUNDS.filter(r => !existingRoundNumbers.has(r.round_number));
      
      if (newRounds.length > 0) {
        const { error: roundsError } = await supabase.from('rounds').insert(newRounds);
        if (roundsError) throw roundsError;
      }
      
      const { data: rounds } = await supabase.from('rounds').select('id, round_number');
      const roundLookup = new Map(rounds?.map(r => [r.round_number, r.id]));
      
      // 4. Create matches
      const matches = [];
      const missingTeams = [];
      
      for (const match of groupStage) {
        const homeName = TEAM_MAPPINGS[match.HomeTeam] || match.HomeTeam;
        const awayName = TEAM_MAPPINGS[match.AwayTeam] || match.AwayTeam;
        
        const homeTeamId = teamLookup.get(homeName);
        const awayTeamId = teamLookup.get(awayName);
        
        if (!homeTeamId) {
          missingTeams.push(homeName);
          continue;
        }
        if (!awayTeamId) {
          missingTeams.push(awayName);
          continue;
        }
        
        matches.push({
          round_id: roundLookup.get(1), // All group stage in round 1
          matchday: match.RoundNumber, // 1, 2, or 3
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          match_time: match.DateUtc,
          status: 'upcoming'
        });
      }
      
      if (matches.length === 0) {
        return res.status(400).json({ 
          error: 'No matches could be created', 
          missingTeams: [...new Set(missingTeams)] 
        });
      }
      
      const { data: insertedMatches, error: matchError } = await supabase
        .from('matches')
        .insert(matches)
        .select();
      
      if (matchError) throw matchError;
      
      return res.status(200).json({
        success: true,
        message: 'Import complete from fixturedownload',
        teamsFound: existingTeams?.length || 0,
        matchesInserted: insertedMatches?.length || 0,
        missingTeams: missingTeams.length > 0 ? [...new Set(missingTeams)] : null
      });
      
    } catch (error) {
      console.error('Import error:', error);
      return res.status(500).json({ error: error.message, stack: error.stack });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
};
