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
        .select('*, teams:team_id(name, flag_url, code)')
        .eq('user_id', user.id);

      if (tournament_id) query = query.eq('tournament_id', tournament_id);

      const { data: picks, error } = await query;
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ picks: picks || [] });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Submit pick
  if (req.method === 'POST') {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Authentication required' });

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

      const { team_id, round_id, tournament_id, matchday } = req.body || {};

      if (!matchday || matchday < 1 || matchday > 3) {
        return res.status(400).json({ error: 'Valid matchday (1-3) required' });
      }

      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .select('picks_required, round_number')
        .eq('id', round_id)
        .single();

      if (roundError) return res.status(500).json({ error: 'Failed to get round settings' });

      const { data: existingMatchdayPicks } = await supabase
        .from('picks')
        .select('id, team_id')
        .eq('user_id', user.id)
        .eq('round_id', round_id)
        .eq('tournament_id', tournament_id)
        .eq('matchday', matchday);

      if (existingMatchdayPicks && existingMatchdayPicks.length >= 3) {
        return res.status(400).json({ error: `You have already made 3 picks for Matchday ${matchday}` });
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

      const { data, error } = await supabase
        .from('picks')
        .insert({ user_id: user.id, team_id, round_id, tournament_id, matchday, result: 'pending', points: 0 })
        .select();

      if (error) return res.status(500).json({ error: error.message });

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
        pick: data[0],
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
