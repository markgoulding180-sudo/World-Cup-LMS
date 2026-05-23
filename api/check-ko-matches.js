// Vercel Function: Check football-data.org for knockout round matches
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
  "Côte d'Ivoire": 'Ivory Coast',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'United States': 'USA',
  'USA': 'United States',
  'Korea DPR': 'North Korea',
  'Kyrgyz Republic': 'Kyrgyzstan'
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  const { round_number, admin_pin } = req.body || {};

  if (admin_pin !== '1234') return res.status(401).json({ error: 'Invalid admin PIN' });
  if (!round_number || round_number < 2 || round_number > 6) {
    return res.status(400).json({ error: 'Valid round_number (2-6) required' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET);

  try {
    // Fetch from football-data.org
    const apiResponse = await fetch(FOOTBALL_DATA_URL, {
      headers: { 'X-Auth-Token': FOOTBALL_DATA_TOKEN }
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return res.status(500).json({ 
        error: `football-data.org API error: ${apiResponse.status}`,
        details: errorText
      });
    }

    const apiData = await apiResponse.json();
    const fixtures = apiData.matches || [];

    // Map round numbers to football-data.org stages
    const stageMap = {
      2: 'LAST_32',
      3: 'LAST_16', 
      4: 'QUARTER_FINALS',
      5: 'SEMI_FINALS',
      6: 'FINAL'
    };

    const targetStage = stageMap[round_number];

    // Look for matches in this stage
    const koMatches = fixtures.filter(f => 
      f.stage === targetStage || 
      (round_number === 6 && f.stage === 'FINAL') // Final might be just 'FINAL'
    );

    if (koMatches.length === 0) {
      return res.status(200).json({
        found: false,
        message: `No ${targetStage} matches found in API yet.`,
        round: round_number,
        stage: targetStage
      });
    }

    // Get teams from DB for mapping
    const { data: teams } = await supabase.from('teams').select('id, name');
    const teamLookup = new Map();
    teams?.forEach(t => {
      teamLookup.set(t.name, t.id);
      teamLookup.set(t.name.toLowerCase(), t.id);
    });

    // Get round ID
    const { data: round } = await supabase
      .from('rounds')
      .select('id')
      .eq('round_number', round_number)
      .single();

    if (!round) {
      return res.status(400).json({ error: `Round ${round_number} not found` });
    }

    // Check if matches already exist for this round
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('round_id', round.id);

    if (existingMatches?.length > 0) {
      return res.status(200).json({
        found: true,
        alreadyLoaded: true,
        message: `${existingMatches.length} matches already loaded for this round.`,
        matches: existingMatches.length
      });
    }

    // Map API matches to DB format
    const matches = [];
    const missingTeams = [];

    for (const match of koMatches) {
      const homeName = TEAM_MAPPINGS[match.homeTeam?.name] || match.homeTeam?.name;
      const awayName = TEAM_MAPPINGS[match.awayTeam?.name] || match.awayTeam?.name;

      const homeTeamId = teamLookup.get(homeName) || teamLookup.get(homeName?.toLowerCase());
      const awayTeamId = teamLookup.get(awayName) || teamLookup.get(awayName?.toLowerCase());

      if (!homeTeamId) { missingTeams.push(match.homeTeam?.name); continue; }
      if (!awayTeamId) { missingTeams.push(match.awayTeam?.name); continue; }

      matches.push({
        round_id: round.id,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        match_time: match.utcDate,
        status: 'upcoming'
      });
    }

    if (matches.length === 0) {
      return res.status(200).json({
        found: true,
        loadable: false,
        message: 'Matches found in API but teams not matched to database.',
        missingTeams: [...new Set(missingTeams)],
        apiMatchesFound: koMatches.length
      });
    }

    // Insert matches
    const { data: inserted, error: insertError } = await supabase
      .from('matches')
      .insert(matches)
      .select();

    if (insertError) {
      return res.status(500).json({ 
        error: 'Failed to insert matches', 
        details: insertError.message 
      });
    }

    return res.status(200).json({
      found: true,
      loaded: true,
      message: `Loaded ${inserted.length} matches for Round ${round_number}`,
      matches: inserted.length,
      missingTeams: missingTeams.length > 0 ? [...new Set(missingTeams)] : null
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
