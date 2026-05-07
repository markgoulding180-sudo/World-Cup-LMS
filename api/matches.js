// Vercel Function: Get Matches
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

    const { status, round_id, limit = 50 } = req.query;

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
