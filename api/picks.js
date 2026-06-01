// Vercel Function: Handle Picks (User + Admin) - Points-based System
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

  // GET - Fetch picks (user's own or all for admin)
  if (req.method === 'GET') {
    try {
      const { admin, tournament_id } = req.query;

      if (admin === 'true') {
        const { data: picks, error } = await supabase
          .from('picks')
          .select(`
            *,
            users:user_id(username, display_name),
            teams:team_id(name, flag_url, group_name),
            rounds:round_id(name, round_number)
          `)
          .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        return res.status(200).json({
          success: true,
          picks: picks || [],
          totalPicks: picks?.length || 0,
          stats: {
            pending: picks?.filter(p => p.result === 'pending').length || 0,
            win: picks?.filter(p => p.result === 'win').length || 0,
            loss: picks?.filter(p => p.result === 'loss').length || 0
          }
        });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Authentication required' });

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

      let query = supabase
        .from('picks')
        .select(`
          *,
          teams:team_id(name, flag_url, code),
          rounds:round_id(name, round_number)
        `)
        .eq('user_id', user.id);

      if (tournament_id) query = query.eq('tournament_id', tournament_id);

      const { data: picks, error } = await query;
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ picks: picks || [] });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Submit pick OR Auto-pick missed rounds
  if (req.method === 'POST') {
    const { action } = req.body || {};
    
    // Handle auto-pick for missed rounds
    if (action === 'auto_pick') {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Authentication required' });

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

        const { tournament_id } = req.body || {};
        if (!tournament_id) return res.status(400).json({ error: 'tournament_id is required' });

        // Get current round
        const { data: currentRound } = await supabase
          .from('rounds')
          .select('*')
          .eq('status', 'open')
          .single();

        if (!currentRound) return res.status(400).json({ error: 'No open round found' });

        // Get all rounds up to current
        const { data: allRounds } = await supabase
          .from('rounds')
          .select('*')
          .order('round_number', { ascending: true });

        const currentRoundIndex = allRounds.findIndex(r => r.id === currentRound.id);
        const previousRounds = allRounds.slice(0, currentRoundIndex);

        // Get user's existing picks
        const { data: userPicks } = await supabase
          .from('picks')
          .select('*')
          .eq('user_id', user.id)
          .eq('tournament_id', tournament_id);

        const autoPicks = [];
        const results = [];

        // Check each previous round for missed picks
        for (const round of previousRounds) {
          const roundPicks = userPicks.filter(p => p.round_id === round.id);
          const expectedPicks = round.picks_required || (round.round_number === 1 ? 9 : 1);
          const missingPicks = expectedPicks - roundPicks.length;

          if (missingPicks > 0) {
            if (round.round_number === 1) {
              // Group stage - get teams by matchday
              const { data: matches } = await supabase
                .from('matches')
                .select('home_team_id, away_team_id, matchday')
                .eq('round_id', round.id);

              const matchdays = { 1: [], 2: [], 3: [] };
              matches.forEach(m => {
                if (matchdays[m.matchday]) {
                  matchdays[m.matchday].push(m.home_team_id, m.away_team_id);
                }
              });

              // For each matchday, pick 3 random teams
              for (let md = 1; md <= 3; md++) {
                const mdPicks = roundPicks.filter(p => p.matchday === md);
                const mdMissing = 3 - mdPicks.length;
                
                if (mdMissing > 0) {
                  const availableTeams = matchdays[md].filter(teamId => {
                    return !userPicks.some(p => p.team_id === teamId);
                  });

                  const shuffled = availableTeams.sort(() => 0.5 - Math.random());
                  const selected = shuffled.slice(0, mdMissing);

                  for (const teamId of selected) {
                    autoPicks.push({
                      user_id: user.id,
                      tournament_id,
                      round_id: round.id,
                      team_id: teamId,
                      matchday: md,
                      result: 'pending',
                      points: 0,
                      is_auto_pick: true
                    });
                  }
                }
              }
            } else {
              // Knockout round - pick from teams playing in this round
              const { data: matches } = await supabase
                .from('matches')
                .select('home_team_id, away_team_id')
                .eq('round_id', round.id);

              const availableTeams = matches.flatMap(m => [m.home_team_id, m.away_team_id])
                .filter(teamId => !userPicks.some(p => p.team_id === teamId));

              if (availableTeams.length > 0) {
                const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
                
                const pickData = {
                  user_id: user.id,
                  tournament_id,
                  round_id: round.id,
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

                autoPicks.push(pickData);
              }
            }

            results.push({
              round: round.name,
              round_number: round.round_number,
              auto_picks_created: autoPicks.filter(p => p.round_id === round.id).length
            });
          }
        }

        // Insert auto-picks
        if (autoPicks.length > 0) {
          const { error: insertError } = await supabase.from('picks').insert(autoPicks);
          if (insertError) return res.status(500).json({ error: 'Failed to create auto-picks: ' + insertError.message });
        }

        return res.status(200).json({
          success: true,
          auto_picks_created: autoPicks.length,
          rounds_updated: results,
          message: autoPicks.length > 0 
            ? `Created ${autoPicks.length} auto-picks for missed rounds`
            : 'No missed picks found - you\'re up to date!'
        });

      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    // Regular pick submission
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Authentication required' });

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

      const { team_id, round_id, tournament_id, matchday, predicted_home_score, predicted_away_score } = req.body || {};

      // Get round info first to determine if matchday is required
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .select('picks_required, round_number, name, picks_closed')
        .eq('id', round_id)
        .single();

      if (roundError) return res.status(500).json({ error: 'Failed to get round settings' });

      // ── Manual override check: admin force-closed picks ──
      if (round.picks_closed === true) {
        return res.status(400).json({ 
          error: `Picks are currently closed for ${round.name}. Please wait for the admin to re-open them.`
        });
      }
      const isKnockoutRound = round.round_number >= 2;

      // Find the earliest match time for this round/matchday
      let deadlineQuery = supabase
        .from('matches')
        .select('match_time')
        .eq('round_id', round_id)
        .order('match_time', { ascending: true })
        .limit(1);

      // For group stage, only check matches in the specific matchday
      if (!isKnockoutRound) {
        deadlineQuery = supabase
          .from('matches')
          .select('match_time')
          .eq('round_id', round_id)
          .eq('matchday', matchday)
          .order('match_time', { ascending: true })
          .limit(1);
      }

      const { data: deadlineMatch } = await deadlineQuery;

      if (deadlineMatch && deadlineMatch.length > 0) {
        const firstKickoff = new Date(deadlineMatch[0].match_time);
        const now = new Date();
        if (now >= firstKickoff) {
          const dateStr = firstKickoff.toLocaleString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London'
          });
          return res.status(400).json({
            error: isKnockoutRound
              ? `Pick deadline passed — ${round.name} kicked off at ${dateStr}`
              : `Pick deadline passed — Matchday ${matchday} kicked off at ${dateStr}`
          });
        }
      }
      
      if (!isKnockoutRound && (!matchday || matchday < 1 || matchday > 3)) {
        return res.status(400).json({ error: 'Valid matchday (1-3) required for Group Stage' });
      }

      // Build query for existing picks
      let existingPicksQuery = supabase
        .from('picks')
        .select('id, team_id')
        .eq('user_id', user.id)
        .eq('round_id', round_id)
        .eq('tournament_id', tournament_id);
      
      // Only filter by matchday for Group Stage
      if (!isKnockoutRound) {
        existingPicksQuery = existingPicksQuery.eq('matchday', matchday);
      }
      
      const { data: existingMatchdayPicks } = await existingPicksQuery;

      // For Group Stage: max 3 picks per matchday
      // For Knockout rounds: max 1 pick per round
      const maxPicks = isKnockoutRound ? 1 : 3;
      if (existingMatchdayPicks && existingMatchdayPicks.length >= maxPicks) {
        return res.status(400).json({ 
          error: isKnockoutRound 
            ? 'You have already made a pick for this round' 
            : `You have already made 3 picks for Matchday ${matchday}` 
        });
      }

      const teamAlreadyPickedThisMatchday = existingMatchdayPicks?.some(p => p.team_id === team_id);
      if (teamAlreadyPickedThisMatchday) {
        return res.status(400).json({ error: 'You have already picked this team for this matchday' });
      }

      // Check tournament-wide team uniqueness - team can only be used ONCE in entire tournament
      const { data: allUserPicks } = await supabase
        .from('picks')
        .select('team_id')
        .eq('user_id', user.id)
        .eq('tournament_id', tournament_id);

      const usedTeamIds = allUserPicks?.map(p => p.team_id) || [];
      if (usedTeamIds.includes(team_id)) {
        return res.status(400).json({ error: 'You have already used this team in a previous round. Each team can only be used once across the entire tournament.' });
      }

      // QF, SF and Final (rounds 4,5,6) require a score prediction
      const isScoreRound = round.round_number >= 4;
      if (isScoreRound) {
        if (predicted_home_score === undefined || predicted_home_score === null ||
            predicted_away_score === undefined || predicted_away_score === null) {
          return res.status(400).json({ error: 'Please enter a score prediction for this round.' });
        }
      }

      const pickInsert = {
        user_id: user.id,
        team_id,
        round_id,
        tournament_id,
        matchday: matchday || null,
        result: 'pending',
        points: 0,
        score_bonus: 0
      };

      if (isScoreRound) {
        pickInsert.predicted_home_score = parseInt(predicted_home_score);
        pickInsert.predicted_away_score = parseInt(predicted_away_score);
      }

      const { data, error } = await supabase
        .from('picks')
        .insert(pickInsert)
        .select();

      if (error) return res.status(500).json({ error: error.message });

      // Fetch the pick with joined team/round data for the response
      const { data: pickWithJoins, error: fetchError } = await supabase
        .from('picks')
        .select(`
          *,
          teams:team_id(name, flag_url, code),
          rounds:round_id(name, round_number)
        `)
        .eq('id', data[0].id)
        .single();

      if (fetchError) {
        // If fetch fails, return basic pick data
        console.error('Failed to fetch pick with joins:', fetchError);
      }

      const pickToReturn = pickWithJoins || data[0];

      // For knockout rounds, just return success
      if (isKnockoutRound) {
        return res.status(200).json({
          success: true,
          pick: pickToReturn,
          roundComplete: true
        });
      }

      // For Group Stage, check matchday progress
      const { data: matchdayPicks } = await supabase
        .from('picks')
        .select('id')
        .eq('user_id', user.id)
        .eq('round_id', round_id)
        .eq('tournament_id', tournament_id)
        .eq('matchday', matchday);

      const isMatchdayComplete = matchdayPicks && matchdayPicks.length >= 3;

      return res.status(200).json({
        success: true,
        pick: pickToReturn,
        matchdayComplete: isMatchdayComplete,
        picksInMatchday: matchdayPicks?.length || 1,
        nextMatchday: isMatchdayComplete && matchday < 3 ? matchday + 1 : null
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};