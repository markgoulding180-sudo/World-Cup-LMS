// Vercel Function: Auto-update results from fixturedownload.com
const { createClient } = require('@supabase/supabase-js');

const FIXTURE_URL = 'https://fixturedownload.com/feed/json/fifa-world-cup-2026';

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

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET
  );

  try {
    // Fetch from fixturedownload
    const response = await fetch(FIXTURE_URL);
    const fixtures = await response.json();

    // Get all matches from database
    const { data: dbMatches } = await supabase
      .from('matches')
      .select('id, home_team_id, away_team_id, home_score, away_score, status, round_id, tournament_id');

    const teamMap = new Map();
    const { data: teams } = await supabase.from('teams').select('id, name');
    teams?.forEach(t => teamMap.set(t.name, t.id));

    let matchesUpdated = 0;
    let picksProcessed = 0;
    let livesDeducted = 0;
    let playersEliminated = 0;

    // Process each fixture that has a result
    for (const fixture of fixtures) {
      // Skip if no scores yet
      if (fixture.HomeTeamScore === null || fixture.AwayTeamScore === null) continue;

      // Find matching database match
      const homeTeamId = teamMap.get(fixture.HomeTeam);
      const awayTeamId = teamMap.get(fixture.AwayTeam);
      
      if (!homeTeamId || !awayTeamId) continue;

      const dbMatch = dbMatches?.find(m => 
        m.home_team_id === homeTeamId && m.away_team_id === awayTeamId
      );

      if (!dbMatch || dbMatch.status === 'finished') continue;

      // Determine result
      let result;
      if (fixture.HomeTeamScore > fixture.AwayTeamScore) result = 'H';
      else if (fixture.AwayTeamScore > fixture.HomeTeamScore) result = 'A';
      else result = 'D';

      // Update match
      await supabase
        .from('matches')
        .update({
          home_score: fixture.HomeTeamScore,
          away_score: fixture.AwayTeamScore,
          result: result,
          status: 'finished'
        })
        .eq('id', dbMatch.id);

      matchesUpdated++;

      // Process picks for this match
      const winningTeamId = result === 'H' ? homeTeamId : 
                           result === 'A' ? awayTeamId : null;

      // Mark picks as win/loss
      if (result === 'D') {
        // Draw - both teams lose
        await supabase
          .from('picks')
          .update({ result: 'loss' })
          .eq('team_id', homeTeamId)
          .eq('result', 'pending');
        
        await supabase
          .from('picks')
          .update({ result: 'loss' })
          .eq('team_id', awayTeamId)
          .eq('result', 'pending');
      } else {
        // Win/Loss
        await supabase
          .from('picks')
          .update({ result: 'win' })
          .eq('team_id', winningTeamId)
          .eq('result', 'pending');
        
        const losingTeamId = result === 'H' ? awayTeamId : homeTeamId;
        await supabase
          .from('picks')
          .update({ result: 'loss' })
          .eq('team_id', losingTeamId)
          .eq('result', 'pending');
      }

      // Get losing picks and deduct lives
      const losingTeamIds = result === 'D' ? [homeTeamId, awayTeamId] : 
                           [result === 'H' ? awayTeamId : homeTeamId];

      for (const losingTeamId of losingTeamIds) {
        const { data: losingPicks } = await supabase
          .from('picks')
          .select('user_id')
          .eq('result', 'loss')
          .eq('team_id', losingTeamId);

        for (const pick of losingPicks || []) {
          picksProcessed++;
          
          const { data: entry } = await supabase
            .from('tournament_entries')
            .select('lives_remaining, tournament_id')
            .eq('user_id', pick.user_id)
            .single();

          if (entry) {
            const currentLives = entry.lives_remaining || 1;
            const newLives = Math.max(0, currentLives - 1);
            livesDeducted++;

            await supabase
              .from('tournament_entries')
              .update({
                lives_remaining: newLives,
                ...(newLives === 0 ? {
                  status: 'eliminated',
                  eliminated_at: new Date().toISOString()
                } : {})
              })
              .eq('user_id', pick.user_id)
              .eq('tournament_id', entry.tournament_id);

            if (newLives === 0) playersEliminated++;
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      matchesUpdated,
      picksProcessed,
      livesDeducted,
      playersEliminated
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
