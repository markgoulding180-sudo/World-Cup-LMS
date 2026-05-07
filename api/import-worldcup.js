// Vercel Function: Import World Cup 2026 data from openfootball
const { createClient } = require('@supabase/supabase-js');

const WORLD_CUP_DATA_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

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

    // Fetch World Cup data
    console.log('Fetching World Cup data from:', WORLD_CUP_DATA_URL);
    const response = await fetch(WORLD_CUP_DATA_URL);
    console.log('Response status:', response.status);
    const text = await response.text();
    
    // Parse JSON (handle potential BOM or whitespace)
    const data = JSON.parse(text.trim());
    console.log('Data loaded, matches:', data.matches?.length);
    
    if (!data.matches || !Array.isArray(data.matches)) {
      return res.status(500).json({ error: 'Invalid data format from source' });
    }

    // Extract unique teams
    const teamsMap = new Map();
    const usedCodes = new Set();
    
    function generateCode(name) {
      // Try first 3 letters
      let code = name.substring(0, 3).toUpperCase();
      if (!usedCodes.has(code)) {
        usedCodes.add(code);
        return code;
      }
      // Try first 2 + last 1
      code = (name.substring(0, 2) + name.substring(name.length - 1)).toUpperCase();
      if (!usedCodes.has(code)) {
        usedCodes.add(code);
        return code;
      }
      // Try first 1 + last 2
      code = (name.substring(0, 1) + name.substring(name.length - 2)).toUpperCase();
      if (!usedCodes.has(code)) {
        usedCodes.add(code);
        return code;
      }
      // Fallback: add number
      let counter = 1;
      while (usedCodes.has(code + counter)) {
        counter++;
      }
      code = code + counter;
      usedCodes.add(code);
      return code;
    }
    
    data.matches.forEach(match => {
      if (!teamsMap.has(match.team1)) {
        teamsMap.set(match.team1, { 
          name: match.team1, 
          group_name: match.group?.replace('Group ', '') || 'A',
          code: generateCode(match.team1)
        });
      }
      if (!teamsMap.has(match.team2)) {
        teamsMap.set(match.team2, { 
          name: match.team2, 
          group_name: match.group?.replace('Group ', '') || 'A',
          code: generateCode(match.team2)
        });
      }
    });

    // Insert teams
    const teams = Array.from(teamsMap.values());
    const { data: insertedTeams, error: teamsError } = await supabase
      .from('teams')
      .upsert(teams, { onConflict: 'code' })
      .select();

    if (teamsError) {
      return res.status(500).json({ error: 'Failed to insert teams', details: teamsError.message });
    }

    // Create a tournament
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

    if (tourneyError) {
      return res.status(500).json({ error: 'Failed to create tournament', details: tourneyError.message });
    }

    // Create rounds
    const rounds = [
      { name: 'Group Stage - Matchday 1', round_number: 1 },
      { name: 'Group Stage - Matchday 2', round_number: 2 },
      { name: 'Group Stage - Matchday 3', round_number: 3 },
      { name: 'Round of 16', round_number: 4 },
      { name: 'Quarter Finals', round_number: 5 },
      { name: 'Semi Finals', round_number: 6 },
      { name: 'Final', round_number: 7 }
    ];

    // First, check if rounds already exist
    const { data: existingRounds } = await supabase
      .from('rounds')
      .select('round_number');
    
    const existingRoundNumbers = new Set(existingRounds?.map(r => r.round_number) || []);
    const newRounds = rounds.filter(r => !existingRoundNumbers.has(r.round_number));
    
    let insertedRounds = [];
    if (newRounds.length > 0) {
      const { data, error: roundsError } = await supabase
        .from('rounds')
        .insert(newRounds)
        .select();
      
      if (roundsError) {
        return res.status(500).json({ error: 'Failed to insert rounds', details: roundsError.message });
      }
      insertedRounds = data || [];
    } else {
      insertedRounds = existingRounds || [];
    }



    return res.status(200).json({
      success: true,
      message: 'World Cup 2026 data imported',
      teams: insertedTeams?.length || 0,
      tournament: tournament,
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
