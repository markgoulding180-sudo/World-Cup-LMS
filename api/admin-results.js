// Vercel Function: Admin - Update match results
const { createClient } = require('@supabase/supabase-js');

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

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET
    );

    const { match_id, home_score, away_score } = req.body;

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
      .update({
        home_score,
        away_score,
        result,
        status: 'finished'
      })
      .eq('id', match_id)
      .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
      .single();

    if (matchError) {
      return res.status(500).json({ error: matchError.message });
    }

    // Determine winning team
    const winningTeamId = result === 'H' ? match.home_team_id : 
                         result === 'A' ? match.away_team_id : null;

    // Only update picks for THIS match's round
    const matchRoundId = match.round_id;

    // If draw, eliminate all picks for this match's teams
    // If win/loss, eliminate picks for losing team
    if (result === 'D') {
      // Draw - both teams' pickers are eliminated
      await supabase
        .from('picks')
        .update({ result: 'loss' })
        .eq('team_id', match.home_team_id)
        .eq('round_id', matchRoundId)
        .eq('result', 'pending');
      
      await supabase
        .from('picks')
        .update({ result: 'loss' })
        .eq('team_id', match.away_team_id)
        .eq('round_id', matchRoundId)
        .eq('result', 'pending');
    } else {
      // Win/Loss - winning team pickers advance, losing team pickers eliminated
      await supabase
        .from('picks')
        .update({ result: 'win' })
        .eq('team_id', winningTeamId)
        .eq('round_id', matchRoundId)
        .eq('result', 'pending');
      
      const losingTeamId = result === 'H' ? match.away_team_id : match.home_team_id;
      await supabase
        .from('picks')
        .update({ result: 'loss' })
        .eq('team_id', losingTeamId)
        .eq('round_id', matchRoundId)
        .eq('result', 'pending');
    }

    // Process losing players — decrement life, eliminate if zero
    const losingTeamIds = result === 'D' 
      ? [match.home_team_id, match.away_team_id]
      : [result === 'H' ? match.away_team_id : match.home_team_id];

    let livesDeducted = 0;

    for (const losingTeamId of losingTeamIds) {
      const { data: losingPicks, error: picksError } = await supabase
        .from('picks')
        .select('user_id, rounds:round_id(round_number)')
        .eq('result', 'loss')
        .eq('team_id', losingTeamId)
        .eq('round_id', match.round_id);

      console.log(`Processing losing picks for team ${losingTeamId}:`, { 
        count: losingPicks?.length, 
        error: picksError?.message,
        round_id: match.round_id 
      });

      for (const pick of losingPicks || []) {
        // Get current lives for this player
        const { data: entry, error: entryError } = await supabase
          .from('tournament_entries')
          .select('lives_remaining, tournament_id')
          .eq('user_id', pick.user_id)
          .single();

        console.log(`Entry for user ${pick.user_id}:`, { 
          entry, 
          error: entryError?.message,
          match_tournament_id: match.tournament_id 
        });

        if (!entry) continue;

        const currentLives = entry.lives_remaining ?? 5;
        const newLives = Math.max(0, currentLives - 1);
        livesDeducted++;

        console.log(`Deducting life: ${currentLives} -> ${newLives} for user ${pick.user_id}`);

        // Update lives, only eliminate if lives hit zero
        const { error: updateError } = await supabase
          .from('tournament_entries')
          .update({
            lives_remaining: newLives,
            ...(newLives === 0 ? {
              status: 'eliminated',
              eliminated_round: pick.rounds?.round_number,
              eliminated_at: new Date().toISOString()
            } : {})
          })
          .eq('user_id', pick.user_id)
          .eq('tournament_id', entry.tournament_id);

        if (updateError) {
          console.error(`Failed to update lives for user ${pick.user_id}:`, updateError);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Match result updated',
      livesDeducted,
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
