// Vercel Function: Admin - Update match results
// Points-based system - awards points for wins instead of deducting lives
const { createClient } = require('@supabase/supabase-js');

// Points structure for each round
const POINTS_STRUCTURE = {
  1: 2,  // Group Stage = 2 points
  2: 4,  // Round of 32 = 4 points
  3: 6,  // Round of 16 = 6 points
  4: 8,  // Quarter Finals = 8 points
  5: 10, // Semi Finals = 10 points
  6: 15  // Final = 15 points
};

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

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET
    );

    const { match_id, home_score, away_score } = req.body || {};

    if (!match_id || home_score === undefined || away_score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Determine result
    let result;
    if (home_score > away_score) result = 'H';
    else if (away_score > home_score) result = 'A';
    else result = 'D';

    // Update match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .update({ home_score, away_score, result, status: 'finished' })
      .eq('id', match_id)
      .select('*, home_team:home_team_id(*), away_team:away_team_id(*), rounds:round_id(round_number)')
      .single();

    if (matchError) {
      return res.status(500).json({ error: matchError.message });
    }

    const winningTeamId = result === 'H' ? match.home_team_id :
                         result === 'A' ? match.away_team_id : null;
    const matchRoundId = match.round_id;
    const roundNumber = match.rounds?.round_number || 1;
    const pointsForWin = POINTS_STRUCTURE[roundNumber] || 2;

    if (result === 'D') {
      await supabase.from('picks').update({ result: 'loss', points: 0 })
        .eq('team_id', match.home_team_id).eq('round_id', matchRoundId).eq('result', 'pending');
      await supabase.from('picks').update({ result: 'loss', points: 0 })
        .eq('team_id', match.away_team_id).eq('round_id', matchRoundId).eq('result', 'pending');
    } else {
      await supabase.from('picks').update({ result: 'win', points: pointsForWin })
        .eq('team_id', winningTeamId).eq('round_id', matchRoundId).eq('result', 'pending');
      const losingTeamId = result === 'H' ? match.away_team_id : match.home_team_id;
      await supabase.from('picks').update({ result: 'loss', points: 0 })
        .eq('team_id', losingTeamId).eq('round_id', matchRoundId).eq('result', 'pending');
    }

    const losingTeamIds = result === 'D'
      ? [match.home_team_id, match.away_team_id]
      : [result === 'H' ? match.away_team_id : match.home_team_id];

    let pointsAwarded = 0;

    // Award points to winners
    if (winningTeamId) {
      const { data: winningPicks } = await supabase
        .from('picks')
        .select('user_id')
        .eq('result', 'win')
        .eq('team_id', winningTeamId)
        .eq('round_id', match.round_id);

      for (const pick of winningPicks || []) {
        await supabase.rpc('increment_points', { 
          user_id: pick.user_id, 
          points: pointsForWin 
        });
        pointsAwarded += pointsForWin;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Match result updated',
      pointsAwarded,
      match: {
        home: match.home_team?.name,
        away: match.away_team?.name,
        score: `${home_score}-${away_score}`,
        result: result === 'H' ? 'Home Win' : result === 'A' ? 'Away Win' : 'Draw'
      }
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
