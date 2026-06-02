// Vercel Function: Handle Rounds (Admin)
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET
  );

  // Body parser for POST requests
  if (req.method === 'POST' && !req.body) {
    await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        try { req.body = JSON.parse(data); } catch { req.body = {}; }
        resolve();
      });
    });
  }

  // GET - List rounds
  if (req.method === 'GET') {
    try {
      const { data: rounds, error } = await supabase
        .from('rounds')
        .select('*')
        .order('round_number', { ascending: true });

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ rounds: rounds || [] });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Open/close round or toggle picks
  if (req.method === 'POST') {
    try {
      const { action, round_id } = req.body || {};

      // Open round - always resets picks_closed to false
      if (action === 'open') {
        const { data, error } = await supabase
          .from('rounds')
          .update({ status: 'open', picks_closed: false })
          .eq('id', round_id)
          .select();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, round: data[0] });
      }

      // Close round
      if (action === 'close') {
        const { data, error } = await supabase
          .from('rounds')
          .update({ status: 'closed' })
          .eq('id', round_id)
          .select();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, round: data[0] });
      }

      // Force close picks (emergency override - keeps round open)
      if (action === 'force_close_picks') {
        const { data, error } = await supabase
          .from('rounds')
          .update({ picks_closed: true })
          .eq('id', round_id)
          .select();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, round: data[0], message: 'Picks forcibly closed' });
      }

      // Force open picks (undo force close)
      if (action === 'force_open_picks') {
        const { data, error } = await supabase
          .from('rounds')
          .update({ picks_closed: false })
          .eq('id', round_id)
          .select();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, round: data[0], message: 'Picks re-opened' });
      }

      // Trigger deadline: close picks + auto-pick for all users who missed
      if (action === 'trigger_deadline') {
        // Step 1: Get round info
        const { data: round, error: roundError } = await supabase
          .from('rounds')
          .select('*')
          .eq('id', round_id)
          .single();
        if (roundError) return res.status(500).json({ error: 'Round not found' });

        // Step 2: Force close picks
        await supabase.from('rounds').update({ picks_closed: true }).eq('id', round_id);

        // Step 3: Get tournament
        const { data: tournament } = await supabase.from('tournaments').select('id').single();
        const tournamentId = tournament?.id;

        // Step 4: Get all active users
        const { data: entries } = await supabase
          .from('tournament_entries')
          .select('user_id')
          .eq('status', 'active');

        let autoPicksCreated = 0;

        // Step 5: For each user, check if they have picks for this round
        for (const entry of entries || []) {
          const { data: userPicks } = await supabase
            .from('picks')
            .select('team_id, matchday')
            .eq('user_id', entry.user_id)
            .eq('round_id', round_id);

          const existingPicks = userPicks || [];

          if (round.round_number === 1) {
            // Group Stage: need 9 picks total (3 per matchday)
            // Get all teams used so far in this round
            const usedTeamIds = new Set(existingPicks.map(p => p.team_id));
            
            for (let md = 1; md <= 3; md++) {
              const mdPicks = existingPicks.filter(p => p.matchday === md);
              const missingPicks = 3 - mdPicks.length;

              if (missingPicks > 0) {
                // Get teams for this matchday
                const { data: matches } = await supabase
                  .from('matches')
                  .select('home_team_id, away_team_id')
                  .eq('round_id', round_id)
                  .eq('matchday', md);

                const matchdayTeams = matches?.flatMap(m => [m.home_team_id, m.away_team_id]) || [];
                
                // Filter out teams already used in ANY matchday of this round
                const unusedTeams = matchdayTeams.filter(tid => !usedTeamIds.has(tid));

                // Randomly select teams
                const shuffled = unusedTeams.sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, missingPicks);

                for (const teamId of selected) {
                  await supabase.from('picks').insert({
                    user_id: entry.user_id,
                    tournament_id: tournamentId,
                    round_id: round_id,
                    team_id: teamId,
                    matchday: md,
                    result: 'pending',
                    points: 0,
                    is_auto_pick: true
                  });
                  usedTeamIds.add(teamId); // Track this team as used
                  autoPicksCreated++;
                }
              }
            }
          } else {
            // Knockout round: need 1 pick
            if (existingPicks.length === 0) {
              // Get teams for this round
              const { data: matches } = await supabase
                .from('matches')
                .select('home_team_id, away_team_id')
                .eq('round_id', round_id);

              const availableTeams = matches?.flatMap(m => [m.home_team_id, m.away_team_id]) || [];
              
              if (availableTeams.length > 0) {
                const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
                
                const pickData = {
                  user_id: entry.user_id,
                  tournament_id: tournamentId,
                  round_id: round_id,
                  team_id: randomTeam,
                  matchday: null,
                  result: 'pending',
                  points: 0,
                  is_auto_pick: true
                };

                // Add score prediction for QF, SF, Final
                if (round.round_number >= 4) {
                  pickData.predicted_home_score = Math.floor(Math.random() * 4);
                  pickData.predicted_away_score = Math.floor(Math.random() * 3);
                }

                await supabase.from('picks').insert(pickData);
                autoPicksCreated++;
              }
            }
          }
        }

        return res.status(200).json({ 
          success: true, 
          round: round,
          auto_picks_created: autoPicksCreated,
          message: `Deadline triggered. ${autoPicksCreated} auto-picks created.`
        });
      }

      return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};