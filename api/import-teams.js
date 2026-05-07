// Vercel Function: Import World Cup 2026 teams (static fallback)
const { createClient } = require('@supabase/supabase-js');

// World Cup 2026 teams with groups (from openfootball data)
const WORLD_CUP_TEAMS = [
  // Group A
  { name: 'Mexico', group_name: 'A', code: 'MEX' },
  { name: 'South Africa', group_name: 'A', code: 'RSA' },
  { name: 'South Korea', group_name: 'A', code: 'KOR' },
  { name: 'Czech Republic', group_name: 'A', code: 'CZE' },
  
  // Group B
  { name: 'Canada', group_name: 'B', code: 'CAN' },
  { name: 'Bosnia & Herzegovina', group_name: 'B', code: 'BIH' },
  { name: 'Qatar', group_name: 'B', code: 'QAT' },
  { name: 'Switzerland', group_name: 'B', code: 'SUI' },
  
  // Group C
  { name: 'Brazil', group_name: 'C', code: 'BRA' },
  { name: 'Morocco', group_name: 'C', code: 'MAR' },
  { name: 'Haiti', group_name: 'C', code: 'HAI' },
  { name: 'Scotland', group_name: 'C', code: 'SCO' },
  
  // Group D
  { name: 'USA', group_name: 'D', code: 'USA' },
  { name: 'Paraguay', group_name: 'D', code: 'PAR' },
  { name: 'Australia', group_name: 'D', code: 'AUS' },
  { name: 'Turkey', group_name: 'D', code: 'TUR' },
  
  // Group E
  { name: 'Germany', group_name: 'E', code: 'GER' },
  { name: 'Curaçao', group_name: 'E', code: 'CUR' },
  { name: 'Ivory Coast', group_name: 'E', code: 'CIV' },
  { name: 'Ecuador', group_name: 'E', code: 'ECU' },
  
  // Group F
  { name: 'Netherlands', group_name: 'F', code: 'NED' },
  { name: 'Japan', group_name: 'F', code: 'JPN' },
  { name: 'Sweden', group_name: 'F', code: 'SWE' },
  { name: 'Tunisia', group_name: 'F', code: 'TUN' },
  
  // Group G
  { name: 'Belgium', group_name: 'G', code: 'BEL' },
  { name: 'Egypt', group_name: 'G', code: 'EGY' },
  { name: 'Iran', group_name: 'G', code: 'IRN' },
  { name: 'New Zealand', group_name: 'G', code: 'NZL' },
  
  // Group H
  { name: 'Spain', group_name: 'H', code: 'ESP' },
  { name: 'Cape Verde', group_name: 'H', code: 'CPV' },
  { name: 'Saudi Arabia', group_name: 'H', code: 'KSA' },
  { name: 'Uruguay', group_name: 'H', code: 'URU' },
  
  // Group I
  { name: 'France', group_name: 'I', code: 'FRA' },
  { name: 'Senegal', group_name: 'I', code: 'SEN' },
  { name: 'Iraq', group_name: 'I', code: 'IRQ' },
  { name: 'Norway', group_name: 'I', code: 'NOR' },
  
  // Group J
  { name: 'Argentina', group_name: 'J', code: 'ARG' },
  { name: 'Algeria', group_name: 'J', code: 'ALG' },
  { name: 'Austria', group_name: 'J', code: 'AUT' },
  { name: 'Jordan', group_name: 'J', code: 'JOR' },
  
  // Group K
  { name: 'Portugal', group_name: 'K', code: 'POR' },
  { name: 'DR Congo', group_name: 'K', code: 'COD' },
  { name: 'Uzbekistan', group_name: 'K', code: 'UZB' },
  { name: 'Colombia', group_name: 'K', code: 'COL' },
  
  // Group L
  { name: 'England', group_name: 'L', code: 'ENG' },
  { name: 'Croatia', group_name: 'L', code: 'CRO' },
  { name: 'Ghana', group_name: 'L', code: 'GHA' },
  { name: 'Panama', group_name: 'L', code: 'PAN' }
];

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
