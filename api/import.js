// Vercel Function: Import from football-data.org - v6
const { createClient } = require('@supabase/supabase-js');

const FOOTBALL_DATA_URL = 'https://api.football-data.org/v4/competitions/WC/matches?season=2026';
const FOOTBALL_DATA_TOKEN = 'aef925b3b2df4c6e922f08a5498bdab0';

const TEAM_MAPPINGS = {
  'Korea Republic': 'South Korea',
  'Czechia': 'Czech Republic',
  'IR Iran': 'Iran',
  'Türkiye': 'Turkey',
  'Congo DR': 'DR Congo',
  'Cabo Verde': 'Cape Verde',
  'Cape Verde Islands': 'Cape Verde',
  "Côte d'Ivoire": 'Ivory Coast',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
  'USA': 'United States',
  'Korea DPR': 'North Korea',
  'Kyrgyz Republic': 'Kyrgyzstan'
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

  // Body parser
  if (!req.body) {
    await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        try { req.body = JSON.parse(data); } catch { req.body = {}; }
        resolve();
      });
    });
  }

  const { action } = req.body || {};
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET
  );

  if (action === 'setup') {
    try {
      // Fetch from football-data.org (single source of truth)
      const response = await fetch(FOOTBALL_DATA_URL, {
        headers: { 'X-Auth-Token': FOOTBALL_DATA_TOKEN }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(500).json({ error: `football-data.org API error: ${response.status} — ${errorText}` });
      }
      
      const apiData = await response.json();
      const fixtures = apiData.matches || [];

      // Group stage matches only
      const groupStage = fixtures.filter(f => f.stage === 'GROUP_STAGE');

      const { data: existingTeams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, code, flag_url, group_name');

      if (teamsError) throw teamsError;

      const teamLookup = new Map();
      existingTeams?.forEach(t => {
        teamLookup.set(t.name, t.id);
        teamLookup.set(t.name.toLowerCase(), t.id);
      });

      const { data: existingRounds } = await supabase.from('rounds').select('round_number');
      const existingRoundNumbers = new Set(existingRounds?.map(r => r.round_number) || []);
      const newRounds = ROUNDS.filter(r => !existingRoundNumbers.has(r.round_number));

      if (newRounds.length > 0) {
        const { error: roundsError } = await supabase.from('rounds').insert(newRounds);
        if (roundsError) throw roundsError;
      }

      const { data: rounds } = await supabase.from('rounds').select('id, round_number');
      const roundLookup = new Map(rounds?.map(r => [r.round_number, r.id]));

      const matches = [];
      const missingTeams = [];

      for (const match of groupStage) {
        const homeName = TEAM_MAPPINGS[match.homeTeam?.name] || match.homeTeam?.name;
        const awayName = TEAM_MAPPINGS[match.awayTeam?.name] || match.awayTeam?.name;

        const homeTeamId = teamLookup.get(homeName) || teamLookup.get(homeName?.toLowerCase());
        const awayTeamId = teamLookup.get(awayName) || teamLookup.get(awayName?.toLowerCase());

        if (!homeTeamId) { missingTeams.push(match.homeTeam?.name || 'Unknown'); continue; }
        if (!awayTeamId) { missingTeams.push(match.awayTeam?.name || 'Unknown'); continue; }

        const matchday = match.matchday || 1;

        matches.push({
          round_id: roundLookup.get(1),
          matchday: matchday,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          match_time: match.utcDate,
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
        message: 'Import complete from football-data.org',
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
