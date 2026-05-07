// Vercel Function: Import World Cup 2026 matches
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
    const response = await fetch(WORLD_CUP_DATA_URL);
    const text = await response.text();
    const data = JSON.parse(text.trim());

    if (!data.matches || !Array.isArray(data.matches)) {
      return res.status(500).json({ error: 'Invalid data format from source' });
    }

    // Get all teams to map names to IDs
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, code');

    if (teamsError) {
      return res.status(500).json({ error: 'Failed to fetch teams', details: teamsError.message });
    }

    // Create team name to ID mapping
    const teamMap = new Map();
    teams.forEach(team => {
      teamMap.set(team.name, team.id);
    });

    // Get rounds to map round names to IDs
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select('id, name, round_number');

    if (roundsError) {
      return res.status(500).json({ error: 'Failed to fetch rounds', details: roundsError.message });
    }

    // Map round names to round IDs
    const roundMap = new Map();
    rounds.forEach(round => {
      roundMap.set(round.round_number, round.id);
    });

    // Map matchday to round number
    function getRoundNumber(roundName) {
      if (roundName.includes('Matchday 1')) return 1;
      if (roundName.includes('Matchday 2')) return 2;
      if (roundName.includes('Matchday 3')) return 3;
      if (roundName.includes('Matchday 4')) return 3;
      if (roundName.includes('Matchday 5')) return 3;
      if (roundName.includes('Matchday 6')) return 3;
      if (roundName.includes('Matchday 7')) return 3;
      if (roundName.includes('Matchday 8')) return 3;
      if (roundName.includes('Matchday 9')) return 3;
      if (roundName.includes('Matchday 10')) return 3;
      if (roundName.includes('Matchday 11')) return 3;
      if (roundName.includes('Matchday 12')) return 3;
      if (roundName.includes('Matchday 13')) return 3;
      if (roundName.includes('Matchday 14')) return 3;
      if (roundName.includes('Matchday 15')) return 3;
      if (roundName.includes('Matchday 16')) return 3;
      if (roundName.includes('Matchday 17')) return 3;
      if (roundName.includes('Round of 32')) return 4;
      if (roundName.includes('Round of 16')) return 5;
      if (roundName.includes('Quarter')) return 6;
      if (roundName.includes('Semi')) return 7;
      if (roundName.includes('Final') && !roundName.includes('third')) return 8;
      return 1; // Default to group stage
    }

    // Process matches
    const matches = [];
    const skipped = [];

    data.matches.forEach((match, index) => {
      // Skip placeholder matches (like "1A vs 2B")
      if (match.team1.match(/^[12][A-L]$/) || match.team2.match(/^[12W][A-Z0-9/-]*$/)) {
        skipped.push({ match: `${match.team1} vs ${match.team2}`, reason: 'Placeholder team codes' });
        return;
      }

      const homeTeamId = teamMap.get(match.team1);
      const awayTeamId = teamMap.get(match.team2);

      if (!homeTeamId || !awayTeamId) {
        skipped.push({ match: `${match.team1} vs ${match.team2}`, reason: 'Team not found' });
        return;
      }

      const roundNumber = getRoundNumber(match.round);
      const roundId = roundMap.get(roundNumber);

      if (!roundId) {
        skipped.push({ match: `${match.team1} vs ${match.team2}`, reason: 'Round not found' });
        return;
      }

      // Parse date and time (handle format like "13:00 UTC-6")
      const timeMatch = match.time.match(/(\d{2}):(\d{2})/);
      if (!timeMatch) {
        skipped.push({ match: `${match.team1} vs ${match.team2}`, reason: 'Invalid time format' });
        return;
      }
      
      // Validate date format (YYYY-MM-DD)
      if (!match.date || !match.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        skipped.push({ match: `${match.team1} vs ${match.team2}`, reason: 'Invalid date format' });
        return;
      }
      
      const [__, hours, minutes] = timeMatch;
      const matchTimeStr = `${match.date}T${hours}:${minutes}:00`;
      const matchTime = new Date(matchTimeStr);
      
      // Validate the date object
      if (isNaN(matchTime.getTime())) {
        skipped.push({ match: `${match.team1} vs ${match.team2}`, reason: 'Invalid date/time value', date: match.date, time: match.time });
        return;
      }

      matches.push({
        round_id: roundId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        match_time: matchTime.toISOString(),
        status: 'upcoming'
      });
    });

    // Insert matches
    if (matches.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No valid matches to import',
        skipped: skipped.length
      });
    }

    // First check for existing matches to avoid duplicates
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id, match_time');
    
    const existingSet = new Set();
    existingMatches?.forEach(m => {
      existingSet.add(`${m.home_team_id}-${m.away_team_id}-${m.match_time}`);
    });
    
    // Filter out duplicates
    const newMatches = matches.filter(m => {
      const key = `${m.home_team_id}-${m.away_team_id}-${m.match_time}`;
      return !existingSet.has(key);
    });
    
    if (newMatches.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All matches already imported',
        skipped: skipped.length,
        duplicatesSkipped: matches.length
      });
    }

    const { data: insertedMatches, error: insertError } = await supabase
      .from('matches')
      .insert(newMatches)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to insert matches', details: insertError.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Matches imported successfully',
      matchesInserted: insertedMatches?.length || 0,
      skipped: skipped.length,
      sample: insertedMatches?.slice(0, 3).map(m => ({
        home: teams.find(t => t.id === m.home_team_id)?.name,
        away: teams.find(t => t.id === m.away_team_id)?.name,
        time: m.match_time
      }))
    });

  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};
