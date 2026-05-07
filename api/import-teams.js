// Vercel Function: Import World Cup 2026 teams (static fallback)
const { createClient } = require('@supabase/supabase-js');

// World Cup 2026 teams with groups (from openfootball data)
// Flag codes mapped to flagcdn.com format
const WORLD_CUP_TEAMS = [
  // Group A
  { name: 'Mexico', group_name: 'A', code: 'MEX', flag_code: 'mx' },
  { name: 'South Africa', group_name: 'A', code: 'RSA', flag_code: 'za' },
  { name: 'South Korea', group_name: 'A', code: 'KOR', flag_code: 'kr' },
  { name: 'Czech Republic', group_name: 'A', code: 'CZE', flag_code: 'cz' },
  
  // Group B
  { name: 'Canada', group_name: 'B', code: 'CAN', flag_code: 'ca' },
  { name: 'Bosnia & Herzegovina', group_name: 'B', code: 'BIH', flag_code: 'ba' },
  { name: 'Qatar', group_name: 'B', code: 'QAT', flag_code: 'qa' },
  { name: 'Switzerland', group_name: 'B', code: 'SUI', flag_code: 'ch' },
  
  // Group C
  { name: 'Brazil', group_name: 'C', code: 'BRA', flag_code: 'br' },
  { name: 'Morocco', group_name: 'C', code: 'MAR', flag_code: 'ma' },
  { name: 'Haiti', group_name: 'C', code: 'HAI', flag_code: 'ht' },
  { name: 'Scotland', group_name: 'C', code: 'SCO', flag_code: 'gb-sct' },
  
  // Group D
  { name: 'USA', group_name: 'D', code: 'USA', flag_code: 'us' },
  { name: 'Paraguay', group_name: 'D', code: 'PAR', flag_code: 'py' },
  { name: 'Australia', group_name: 'D', code: 'AUS', flag_code: 'au' },
  { name: 'Turkey', group_name: 'D', code: 'TUR', flag_code: 'tr' },
  
  // Group E
  { name: 'Germany', group_name: 'E', code: 'GER', flag_code: 'de' },
  { name: 'Curaçao', group_name: 'E', code: 'CUR', flag_code: 'cw' },
  { name: 'Ivory Coast', group_name: 'E', code: 'CIV', flag_code: 'ci' },
  { name: 'Ecuador', group_name: 'E', code: 'ECU', flag_code: 'ec' },
  
  // Group F
  { name: 'Netherlands', group_name: 'F', code: 'NED', flag_code: 'nl' },
  { name: 'Japan', group_name: 'F', code: 'JPN', flag_code: 'jp' },
  { name: 'Sweden', group_name: 'F', code: 'SWE', flag_code: 'se' },
  { name: 'Tunisia', group_name: 'F', code: 'TUN', flag_code: 'tn' },
  
  // Group G
  { name: 'Belgium', group_name: 'G', code: 'BEL', flag_code: 'be' },
  { name: 'Egypt', group_name: 'G', code: 'EGY', flag_code: 'eg' },
  { name: 'Iran', group_name: 'G', code: 'IRN', flag_code: 'ir' },
  { name: 'New Zealand', group_name: 'G', code: 'NZL', flag_code: 'nz' },
  
  // Group H
  { name: 'Spain', group_name: 'H', code: 'ESP', flag_code: 'es' },
  { name: 'Cape Verde', group_name: 'H', code: 'CPV', flag_code: 'cv' },
  { name: 'Saudi Arabia', group_name: 'H', code: 'KSA', flag_code: 'sa' },
  { name: 'Uruguay', group_name: 'H', code: 'URU', flag_code: 'uy' },
  
  // Group I
  { name: 'France', group_name: 'I', code: 'FRA', flag_code: 'fr' },
  { name: 'Senegal', group_name: 'I', code: 'SEN', flag_code: 'sn' },
  { name: 'Iraq', group_name: 'I', code: 'IRQ', flag_code: 'iq' },
  { name: 'Norway', group_name: 'I', code: 'NOR', flag_code: 'no' },
  
  // Group J
  { name: 'Argentina', group_name: 'J', code: 'ARG', flag_code: 'ar' },
  { name: 'Algeria', group_name: 'J', code: 'ALG', flag_code: 'dz' },
  { name: 'Austria', group_name: 'J', code: 'AUT', flag_code: 'at' },
  { name: 'Jordan', group_name: 'J', code: 'JOR', flag_code: 'jo' },
  
  // Group K
  { name: 'Portugal', group_name: 'K', code: 'POR', flag_code: 'pt' },
  { name: 'DR Congo', group_name: 'K', code: 'COD', flag_code: 'cd' },
  { name: 'Uzbekistan', group_name: 'K', code: 'UZB', flag_code: 'uz' },
  { name: 'Colombia', group_name: 'K', code: 'COL', flag_code: 'co' },
  
  // Group L
  { name: 'England', group_name: 'L', code: 'ENG', flag_code: 'gb-eng' },
  { name: 'Croatia', group_name: 'L', code: 'CRO', flag_code: 'hr' },
  { name: 'Ghana', group_name: 'L', code: 'GHA', flag_code: 'gh' },
  { name: 'Panama', group_name: 'L', code: 'PAN', flag_code: 'pa' }
];

// Add flag_url to each team
WORLD_CUP_TEAMS.forEach(team => {
  team.flag_url = `https://flagcdn.com/w80/${team.flag_code}.png`;
});

const ROUNDS = [
  { name: 'Group Stage - Matchday 1', round_number: 1 },
  { name: 'Group Stage - Matchday 2', round_number: 2 },
  { name: 'Group Stage - Matchday 3', round_number: 3 },
  { name: 'Round of 32', round_number: 4 },
  { name: 'Round of 16', round_number: 5 },
  { name: 'Quarter Finals', round_number: 6 },
  { name: 'Semi Finals', round_number: 7 },
  { name: 'Final', round_number: 8 }
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

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET
    );

    // Insert teams
    const { data: insertedTeams, error: teamsError } = await supabase
      .from('teams')
      .upsert(WORLD_CUP_TEAMS, { onConflict: 'code' })
      .select();

    if (teamsError) {
      console.error('Teams error:', teamsError);
      return res.status(500).json({ error: 'Failed to insert teams', details: teamsError.message });
    }

    // Create tournament
    const { data: tournament, error: tourneyError } = await supabase
      .from('tournaments')
      .insert({
        name: 'World Cup 2026 Last Man Standing',
        entry_fee: 20,
        prize_pool: 0,
        status: 'upcoming'
      })
      .select()
      .single();

    if (tourneyError && tourneyError.code !== '23505') { // Ignore duplicate
      console.error('Tournament error:', tourneyError);
      return res.status(500).json({ error: 'Failed to create tournament', details: tourneyError.message });
    }

    // Check existing rounds
    const { data: existingRounds } = await supabase
      .from('rounds')
      .select('round_number');
    
    const existingRoundNumbers = new Set(existingRounds?.map(r => r.round_number) || []);
    const newRounds = ROUNDS.filter(r => !existingRoundNumbers.has(r.round_number));
    
    let insertedRounds = [];
    if (newRounds.length > 0) {
      const { data, error: roundsError } = await supabase
        .from('rounds')
        .insert(newRounds)
        .select();
      
      if (roundsError) {
        console.error('Rounds error:', roundsError);
        return res.status(500).json({ error: 'Failed to insert rounds', details: roundsError.message });
      }
      insertedRounds = data || [];
    }

    return res.status(200).json({
      success: true,
      message: 'World Cup 2026 data imported',
      teams: insertedTeams?.length || 0,
      rounds: insertedRounds?.length || 0
    });

  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};
