// Vercel Function: Get Matches + Qualified Teams - v3
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET
    );

    const { status, round_id, matchday, limit = 50, qualified } = req.query;

    // Handle qualified teams request
    if (qualified === 'true') {
      const { data: matches } = await supabase
        .from('matches')
        .select('home_team_id, away_team_id, home_score, away_score, result, matchday')
        .eq('status', 'finished')
        .in('matchday', [1, 2, 3]);

      if (!matches || matches.length === 0) {
        return res.status(200).json({ qualified: [], message: 'No group stage results yet' });
      }

      const { data: teams } = await supabase.from('teams').select('id, name, code, flag_url, group_name');
      if (!teams) return res.status(500).json({ error: 'Could not load teams' });

      const standings = {};
      teams.forEach(t => {
        standings[t.id] = { id: t.id, name: t.name, code: t.code, flag_url: t.flag_url, group_name: t.group_name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
      });

      matches.forEach(m => {
        const home = standings[m.home_team_id];
        const away = standings[m.away_team_id];
        if (!home || !away) return;
        home.played++; away.played++;
        home.gf += m.home_score || 0; home.ga += m.away_score || 0;
        away.gf += m.away_score || 0; away.ga += m.home_score || 0;
        if (m.result === 'H') { home.won++; home.points += 3; away.lost++; }
        else if (m.result === 'A') { away.won++; away.points += 3; home.lost++; }
        else { home.drawn++; home.points++; away.drawn++; away.points++; }
      });

      const groups = {};
      Object.values(standings).forEach(t => { if (!groups[t.group_name]) groups[t.group_name] = []; groups[t.group_name].push(t); });
      const sortFn = (a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf;
      Object.values(groups).forEach(g => g.sort(sortFn));

      const qualified = [];
      const thirdPlace = [];
      Object.values(groups).forEach(group => {
        if (group.length >= 1) qualified.push({ ...group[0], position: '1st' });
        if (group.length >= 2) qualified.push({ ...group[1], position: '2nd' });
        if (group.length >= 3) thirdPlace.push(group[2]);
      });
      thirdPlace.sort(sortFn);
      thirdPlace.slice(0, 8).forEach(t => qualified.push({ ...t, position: '3rd' }));

      return res.status(200).json({
        qualified: qualified.map(q => ({ id: q.id, name: q.name, code: q.code, flag_url: q.flag_url, group_name: q.group_name, position: q.position, points: q.points, played: q.played })),
        totalGroups: Object.keys(groups).length,
        matchesFinished: matches.length
      });
    }

    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:home_team_id(name, flag_url, code),
        away_team:away_team_id(name, flag_url, code),
        rounds:round_id(name, round_number)
      `)
      .order('match_time', { ascending: true })
      .limit(parseInt(limit));

    if (status) {
      query = query.eq('status', status);
    }

    if (round_id) {
      query = query.eq('round_id', round_id);
    }

    if (matchday) {
      query = query.eq('matchday', parseInt(matchday));
    }

    const { data: matches, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      matches: matches || [],
      count: matches?.length || 0
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
