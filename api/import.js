// Vercel Function: Import from fixturedownload.com - v4
// Uses fixturedownload API and maps flags from master_teams
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

  // SETUP - Import teams and matches from fixturedownload
  if (action === 'setup') {
    try {
      // 1. Fetch from fixturedownload
      const response = await fetch(FIXTURE_URL);
      const fixtures = await response.json();
      
      // Filter group stage only (RoundNumber 1-3)
      const groupStage = fixtures.filter(f => f.RoundNumber >= 1 && f.RoundNumber <= 3);
      
      // 2. Get flags from master_teams
      const { data: masterTeams } = await supabase.from('master_teams').select('name, flag_url, code');
      const flagMap = new Map(masterTeams?.map(t => [t.name, { flag_url: t.flag_url, code: t.code }]));
      
      // 3. Extract teams with flags
      const teamsMap = new Map();
      groupStage.forEach(match => {
        const homeName = TEAM_MAPPINGS[match.HomeTeam] || match.HomeTeam;
        const awayName = TEAM_MAPPINGS[match.AwayTeam] || match.AwayTeam;
        const group = match.Group?.replace('Group ', '') || '';
        
        if (!teamsMap.has(homeName)) {
          const flags = flagMap.get(homeName) || {};
          teamsMap.set(homeName, { 
            name: homeName, 
            group_name: group, 
            flag_url: flags.flag_url || `https://flagcdn.com/w80/${homeName.substring(0,2).toLowerCase()}.png`,
            code: flags.code || homeName.substring(0,3).toUpperCase()
          });
        }
        if (!teamsMap.has(awayName)) {
          const flags = flagMap.get(awayName) || {};
          teamsMap.set(awayName, { 
            name: awayName, 
            group_name: group,
            flag_url: flags.flag_url || `https://flagcdn.com/w80/${awayName.substring(0,2).toLowerCase()}.png`,
            code: flags.code || awayName.substring(0,3).toUpperCase()
          });
        }
      });
      
      const teams = Array.from(teamsMap.values());
      
      // 4. Insert teams
      const { data: insertedTeams, error: teamError } = await supabase
        .from('teams')
        .insert(teams)
        .select();
      
      if (teamError) throw teamError;
      
      // 5. Create team lookup
      const teamLookup = new Map(insertedTeams?.map(t => [t.name, t.id]));
      
      // 6. Create rounds
      const { data: existingRounds } = await supabase.from('rounds').select('round_number');
      const existingRoundNumbers = new Set(existingRounds?.map(r => r.round_number) || []);
      const newRounds = ROUNDS.filter(r => !existingRoundNumbers.has(r.round_number));
      
      if (newRounds.length > 0) {
        await supabase.from('rounds').insert(newRounds);
      }
      
      const { data: rounds } = await supabase.from('rounds').select('id, round_number');
      const roundLookup = new Map(rounds?.map(r => [r.round_number, r.id]));
      
      // 7. Create matches
      const matches = groupStage.map(match => {
        const homeName = TEAM_MAPPINGS[match.HomeTeam] || match.HomeTeam;
        const awayName = TEAM_MAPPINGS[match.AwayTeam] || match.AwayTeam;
        
        return {
          round_id: roundLookup.get(1), // All group stage in round 1
          matchday: match.RoundNumber, // 1, 2, or 3
          home_team_id: teamLookup.get(homeName),
          away_team_id: teamLookup.get(awayName),
          match_time: match.DateUtc,
          status: 'upcoming'
        };
      });
      
      const { data: insertedMatches, error: matchError } = await supabase
        .from('matches')
        .insert(matches)
        .select();
      
      if (matchError) throw matchError;
      
      return res.status(200).json({
        success: true,
        message: 'Import complete from fixturedownload',
        teamsInserted: insertedTeams?.length || 0,
        matchesInserted: insertedMatches?.length || 0
      });
      
    } catch (error) {
      console.error('Import error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
};
