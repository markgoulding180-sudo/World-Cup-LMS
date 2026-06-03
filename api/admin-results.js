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

    const { 
      match_id, 
      home_score, 
      away_score, 
      et_home_score, 
      et_away_score, 
      pen_home_score, 
      pen_away_score,
      winner_team_id 
    } = req.body || {};

    if (!match_id || home_score === undefined || away_score === undefined) {
      return res.status(400).json({ error: 'Missing required fields: match_id, home_score, away_score' });
    }

    // Determine result from scores or explicit winner
    let result;
    let finalWinnerId = winner_team_id || null;
    
    if (finalWinnerId) {
      // Use explicit winner if provided
      const { data: matchData } = await supabase
        .from('matches')
        .select('home_team_id, away_team_id')
        .eq('id', match_id)
        .single();
      
      if (matchData) {
        if (finalWinnerId === matchData.home_team_id) result = 'H';
        else if (finalWinnerId === matchData.away_team_id) result = 'A';
        else result = 'D';
      } else {
        result = 'D';
      }
    } else {
      // Determine from 90-minute scores
      if (home_score > away_score) result = 'H';
      else if (away_score > home_score) result = 'A';
      else result = 'D';
      
      // For draws, check if ET/penalty scores provided to determine winner
      if (result === 'D' && (et_home_score !== undefined || pen_home_score !== undefined)) {
        // Check ET scores first
        if (et_home_score !== undefined && et_away_score !== undefined) {
          if (et_home_score > et_away_score) result = 'H';
          else if (et_away_score > et_home_score) result = 'A';
        }
        
        // If still draw, check penalty scores
        if (result === 'D' && pen_home_score !== undefined && pen_away_score !== undefined) {
          if (pen_home_score > pen_away_score) result = 'H';
          else if (pen_away_score > pen_home_score) result = 'A';
        }
      }
    }

    // Update match with all score data
    const updateData = {
      home_score,
      away_score,
      et_home_score: et_home_score ?? null,
      et_away_score: et_away_score ?? null,
      pen_home_score: pen_home_score ?? null,
      pen_away_score: pen_away_score ?? null,
      winner_team_id: finalWinnerId,
      result,
      status: 'finished'
    };

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', match_id)
      .select('*, home_team:home_team_id(*), away_team:away_team_id(*), rounds:round_id(round_number)')
      .single();

    if (matchError) {
      return res.status(500).json({ error: matchError.message });
    }

    const winningTeamId = result === 'H' ? match.home_team_id :
                         result === 'A' ? match.away_team_id : null;
    
    // Update winner_team_id if not already set
    if (!match.winner_team_id && winningTeamId) {
      await supabase
        .from('matches')
        .update({ winner_team_id: winningTeamId })
        .eq('id', match_id);
    }
    const matchRoundId = match.round_id;
    const roundNumber = match.rounds?.round_number || 1;
    const pointsForWin = POINTS_STRUCTURE[roundNumber] || 2;

    // Get matchday for filtering picks (Group Stage has multiple matchdays)
    const matchday = match.matchday;

    if (result === 'D') {
      let homeQuery = supabase.from('picks').update({ result: 'loss', points: 0 })
        .eq('team_id', match.home_team_id).eq('round_id', matchRoundId).eq('result', 'pending');
      let awayQuery = supabase.from('picks').update({ result: 'loss', points: 0 })
        .eq('team_id', match.away_team_id).eq('round_id', matchRoundId).eq('result', 'pending');
      
      // Add matchday filter for Group Stage (round 1)
      if (roundNumber === 1 && matchday) {
        homeQuery = homeQuery.eq('matchday', matchday);
        awayQuery = awayQuery.eq('matchday', matchday);
      }
      
      await homeQuery;
      await awayQuery;
    } else {
      let winQuery = supabase.from('picks').update({ result: 'win', points: pointsForWin })
        .eq('team_id', winningTeamId).eq('round_id', matchRoundId).eq('result', 'pending');
      
      // Add matchday filter for Group Stage (round 1)
      if (roundNumber === 1 && matchday) {
        winQuery = winQuery.eq('matchday', matchday);
      }
      
      await winQuery;
      
      const losingTeamId = result === 'H' ? match.away_team_id : match.home_team_id;
      let lossQuery = supabase.from('picks').update({ result: 'loss', points: 0 })
        .eq('team_id', losingTeamId).eq('round_id', matchRoundId).eq('result', 'pending');
      
      // Add matchday filter for Group Stage (round 1)
      if (roundNumber === 1 && matchday) {
        lossQuery = lossQuery.eq('matchday', matchday);
      }
      
      await lossQuery;
    }

    const losingTeamIds = result === 'D'
      ? [match.home_team_id, match.away_team_id]
      : [result === 'H' ? match.away_team_id : match.home_team_id];

    let pointsAwarded = 0;

    // Award points to winners
    if (winningTeamId) {
      let winningPicksQuery = supabase
        .from('picks')
        .select('id, user_id, predicted_home_score, predicted_away_score')
        .eq('result', 'win')
        .eq('team_id', winningTeamId)
        .eq('round_id', match.round_id);
      
      // Add matchday filter for Group Stage (round 1)
      if (roundNumber === 1 && matchday) {
        winningPicksQuery = winningPicksQuery.eq('matchday', matchday);
      }
      
      const { data: winningPicks } = await winningPicksQuery;

      for (const pick of winningPicks || []) {
        let totalPointsForPick = pointsForWin;

        // ── Score bonus for QF, SF, Final (rounds 4, 5, 6) ──
        // Compare prediction to 90-MINUTE score only
        if (roundNumber >= 4 && 
            pick.predicted_home_score !== null && 
            pick.predicted_away_score !== null &&
            parseInt(pick.predicted_home_score) === home_score &&
            parseInt(pick.predicted_away_score) === away_score) {
          
          // Award 3 bonus points for correct 90-minute score prediction
          await supabase
            .from('picks')
            .update({ score_bonus: 3, points: pointsForWin + 3 })
            .eq('id', pick.id);

          totalPointsForPick = pointsForWin + 3;
        }

        await supabase.rpc('increment_points', { 
          user_id: pick.user_id, 
          points: totalPointsForPick 
        });
        pointsAwarded += totalPointsForPick;
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
