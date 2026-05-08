// Vercel Function: Import (Teams, Matches, Reset, WorldCup) - v3
// Updated for structured 9-pick group stage (3 per matchday)
const { createClient } = require('@supabase/supabase-js');

const WORLD_CUP_DATA_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

// World Cup 2026 teams
const WORLD_CUP_TEAMS = [
  { name: 'Mexico', group_name: 'A', code: 'MEX', flag_url: 'https://flagcdn.com/w80/mx.png' },
  { name: 'South Africa', group_name: 'A', code: 'RSA', flag_url: 'https://flagcdn.com/w80/za.png' },
  { name: 'South Korea', group_name: 'A', code: 'KOR', flag_url: 'https://flagcdn.com/w80/kr.png' },
  { name: 'Czech Republic', group_name: 'A', code: 'CZE', flag_url: 'https://flagcdn.com/w80/cz.png' },
  { name: 'Canada', group_name: 'B', code: 'CAN', flag_url: 'https://flagcdn.com/w80/ca.png' },
  { name: 'Bosnia & Herzegovina', group_name: 'B', code: 'BIH', flag_url: 'https://flagcdn.com/w80/ba.png' },
  { name: 'Qatar', group_name: 'B', code: 'QAT', flag_url: 'https://flagcdn.com/w80/qa.png' },
  { name: 'Switzerland', group_name: 'B', code: 'SUI', flag_url: 'https://flagcdn.com/w80/ch.png' },
  { name: 'Brazil', group_name: 'C', code: 'BRA', flag_url: 'https://flagcdn.com/w80/br.png' },
  { name: 'Morocco', group_name: 'C', code: 'MAR', flag_url: 'https://flagcdn.com/w80/ma.png' },
  { name: 'Haiti', group_name: 'C', code: 'HAI', flag_url: 'https://flagcdn.com/w80/ht.png' },
  { name: 'Scotland', group_name: 'C', code: 'SCO', flag_url: 'https://flagcdn.com/w80/gb-sct.png' },
  { name: 'USA', group_name: 'D', code: 'USA', flag_url: 'https://flagcdn.com/w80/us.png' },
  { name: 'Paraguay', group_name: 'D', code: 'PAR', flag_url: 'https://flagcdn.com/w80/py.png' },
  { name: 'Australia', group_name: 'D', code: 'AUS', flag_url: 'https://flagcdn.com/w80/au.png' },
  { name: 'Turkey', group_name: 'D', code: 'TUR', flag_url: 'https://flagcdn.com/w80/tr.png' },
  { name: 'Germany', group_name: 'E', code: 'GER', flag_url: 'https://flagcdn.com/w80/de.png' },
  { name: 'Curaçao', group_name: 'E', code: 'CUR', flag_url: 'https://flagcdn.com/w80/cw.png' },
  { name: 'Ivory Coast', group_name: 'E', code: 'CIV', flag_url: 'https://flagcdn.com/w80/ci.png' },
  { name: 'Ecuador', group_name: 'E', code: 'ECU', flag_url: 'https://flagcdn.com/w80/ec.png' },
  { name: 'Netherlands', group_name: 'F', code: 'NED', flag_url: 'https://flagcdn.com/w80/nl.png' },
  { name: 'Japan', group_name: 'F', code: 'JPN', flag_url: 'https://flagcdn.com/w80/jp.png' },
  { name: 'Sweden', group_name: 'F', code: 'SWE', flag_url: 'https://flagcdn.com/w80/se.png' },
  { name: 'Tunisia', group_name: 'F', code: 'TUN', flag_url: 'https://flagcdn.com/w80/tn.png' },
  { name: 'Belgium', group_name: 'G', code: 'BEL', flag_url: 'https://flagcdn.com/w80/be.png' },
  { name: 'Egypt', group_name: 'G', code: 'EGY', flag_url: 'https://flagcdn.com/w80/eg.png' },
  { name: 'Iran', group_name: 'G', code: 'IRN', flag_url: 'https://flagcdn.com/w80/ir.png' },
  { name: 'New Zealand', group_name: 'G', code: 'NZL', flag_url: 'https://flagcdn.com/w80/nz.png' },
  { name: 'Spain', group_name: 'H', code: 'ESP', flag_url: 'https://flagcdn.com/w80/es.png' },
  { name: 'Cape Verde', group_name: 'H', code: 'CPV', flag_url: 'https://flagcdn.com/w80/cv.png' },
  { name: 'Saudi Arabia', group_name: 'H', code: 'KSA', flag_url: 'https://flagcdn.com/w80/sa.png' },
  { name: 'Uruguay', group_name: 'H', code: 'URU', flag_url: 'https://flagcdn.com/w80/uy.png' },
  { name: 'France', group_name: 'I', code: 'FRA', flag_url: 'https://flagcdn.com/w80/fr.png' },
  { name: 'Senegal', group_name: 'I', code: 'SEN', flag_url: 'https://flagcdn.com/w80/sn.png' },
  { name: 'Iraq', group_name: 'I', code: 'IRQ', flag_url: 'https://flagcdn.com/w80/iq.png' },
  { name: 'Norway', group_name: 'I', code: 'NOR', flag_url: 'https://flagcdn.com/w80/no.png' },
  { name: 'Argentina', group_name: 'J', code: 'ARG', flag_url: 'https://flagcdn.com/w80/ar.png' },
  { name: 'Algeria', group_name: 'J', code: 'ALG', flag_url: 'https://flagcdn.com/w80/dz.png' },
  { name: 'Austria', group_name: 'J', code: 'AUT', flag_url: 'https://flagcdn.com/w80/at.png' },
  { name: 'Jordan', group_name: 'J', code: 'JOR', flag_url: 'https://flagcdn.com/w80/jo.png' },
  { name: 'Portugal', group_name: 'K', code: 'POR', flag_url: 'https://flagcdn.com/w80/pt.png' },
  { name: 'DR Congo', group_name: 'K', code: 'COD', flag_url: 'https://flagcdn.com/w80/cd.png' },
  { name: 'Uzbekistan', group_name: 'K', code: 'UZB', flag_url: 'https://flagcdn.com/w80/uz.png' },
  { name: 'Colombia', group_name: 'K', code: 'COL', flag_url: 'https://flagcdn.com/w80/co.png' },
  { name: 'England', group_name: 'L', code: 'ENG', flag_url: 'https://flagcdn.com/w80/gb-eng.png' },
  { name: 'Croatia', group_name: 'L', code: 'CRO', flag_url: 'https://flagcdn.com/w80/hr.png' },
  { name: 'Ghana', group_name: 'L', code: 'GHA', flag_url: 'https://flagcdn.com/w80/gh.png' },
  { name: 'Panama', group_name: 'L', code: 'PAN', flag_url: 'https://flagcdn.com/w80/pa.png' }
];

// Updated rounds: Group Stage is now one round with 9 picks (3 per matchday)
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

  // RESET TEAMS - Clear and re-import
  if (action === 'reset-teams') {
    try {
      // Delete all teams
      await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Insert correct teams
      const { data: insertedTeams, error } = await supabase.from('teams').insert(WORLD_CUP_TEAMS).select();
      
      if (error) throw error;
      
      return res.status(200).json({
        success: true,
        message: 'Teams reset successfully',
        teamsInserted: insertedTeams?.length || 0
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // IMPORT MATCHES
  if (action === 'import-matches') {
    try {
      const response = await fetch(WORLD_CUP_DATA_URL);
      const text = await response.text();
      const data = JSON.parse(text.trim());

      if (!data.matches || !Array.isArray(data.matches)) {
        return res.status(500).json({ error: 'Invalid data format' });
      }

      // Get teams and rounds
      const { data: teams } = await supabase.from('teams').select('id, name');
      const { data: rounds } = await supabase.from('rounds').select('id, round_number');
      
      const teamMap = new Map(teams?.map(t => [t.name, t.id]));
      const roundMap = new Map(rounds?.map(r => [r.round_number, r.id]));

      function getRoundNumber(roundName) {
        // Group stage all maps to round 1 (Group Stage)
        if (roundName.includes('Matchday')) return 1;
        // Knockout rounds
        if (roundName.includes('Round of 32')) return 2;
        if (roundName.includes('Round of 16')) return 3;
        if (roundName.includes('Quarter')) return 4;
        if (roundName.includes('Semi')) return 5;
        if (roundName.includes('Final') && !roundName.includes('third')) return 6;
        return 1;
      }

      function getMatchday(roundName) {
        // Extract matchday number from group stage matches
        const match = roundName.match(/Matchday\s*(\d+)/i);
        if (match) {
          const matchday = parseInt(match[1]);
          // Map matchdays 1-6 to 1, 7-12 to 2, 13+ to 3 (for 48-team format)
          if (matchday <= 6) return 1;
          if (matchday <= 12) return 2;
          return 3;
        }
        return null; // Knockout matches have no matchday
      }

      const matches = [];
      const skipped = [];

      data.matches.forEach(match => {
        if (match.team1.match(/^[12W][A-Z0-9/-]*$/)) {
          skipped.push({ match: `${match.team1} vs ${match.team2}`, reason: 'Placeholder' });
          return;
        }

        const homeTeamId = teamMap.get(match.team1);
        const awayTeamId = teamMap.get(match.team2);
        if (!homeTeamId || !awayTeamId) {
          skipped.push({ match: `${match.team1} vs ${match.team2}`, reason: 'Team not found' });
          return;
        }

        const roundId = roundMap.get(getRoundNumber(match.round));
        if (!roundId) {
          skipped.push({ match: `${match.team1} vs ${match.team2}`, reason: 'Round not found' });
          return;
        }

        const timeMatch = match.time.match(/(\d{2}):(\d{2})/);
        if (!timeMatch || !match.date?.match(/^\d{4}-\d{2}-\d{2}$/)) {
          skipped.push({ match: `${match.team1} vs ${match.team2}`, reason: 'Invalid date/time' });
          return;
        }

        const [_, hours, minutes] = timeMatch;
        const matchTime = new Date(`${match.date}T${hours}:${minutes}:00`);
        if (isNaN(matchTime.getTime())) {
          skipped.push({ match: `${match.team1} vs ${match.team2}`, reason: 'Invalid date' });
          return;
        }

        matches.push({
          round_id: roundId,
          matchday: getMatchday(match.round),
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          match_time: matchTime.toISOString(),
          status: 'upcoming'
        });
      });

      // Check for existing matches
      const { data: existingMatches } = await supabase.from('matches').select('home_team_id, away_team_id, match_time');
      const existingSet = new Set(existingMatches?.map(m => `${m.home_team_id}-${m.away_team_id}-${m.match_time}`));
      const newMatches = matches.filter(m => !existingSet.has(`${m.home_team_id}-${m.away_team_id}-${m.match_time}`));

      if (newMatches.length === 0) {
        return res.status(200).json({ success: true, message: 'All matches already imported', skipped: skipped.length });
      }

      const { data: insertedMatches, error } = await supabase.from('matches').insert(newMatches).select();
      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: 'Matches imported successfully',
        matchesInserted: insertedMatches?.length || 0,
        skipped: skipped.length
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // SETUP - Create rounds and tournament
  if (action === 'setup') {
    try {
      // Create rounds
      const { data: existingRounds } = await supabase.from('rounds').select('round_number');
      const existingRoundNumbers = new Set(existingRounds?.map(r => r.round_number) || []);
      const newRounds = ROUNDS.filter(r => !existingRoundNumbers.has(r.round_number));
      
      if (newRounds.length > 0) {
        await supabase.from('rounds').insert(newRounds);
      }

      // Create tournament
      const { error: tourneyError } = await supabase.from('tournaments').insert({
        name: 'World Cup 2026 Last Man Standing',
        entry_fee: 20,
        prize_pool: 0,
        status: 'upcoming'
      });

      return res.status(200).json({
        success: true,
        message: 'Setup complete',
        roundsCreated: newRounds.length
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
};
