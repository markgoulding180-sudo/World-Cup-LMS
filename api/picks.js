// Vercel Function: Handle Picks (User + Admin)
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

  // GET - Fetch picks (user's own or all for admin)
  if (req.method === 'GET') {
    try {
      const { admin } = req.query;
      
      // Admin request - return all picks
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

        if (error) {
          return res.status(500).json({ error: error.message });
        }

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

      // User request - return own picks
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { data: picks, error } = await supabase
        .from('picks')
        .select('*, teams:team_id(name, flag_url)')
        .eq('user_id', user.id);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ picks: picks || [] });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Submit pick
  if (req.method === 'POST') {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { team_id, round_id, tournament_id } = req.body;

      // Insert pick
      const { data, error } = await supabase
        .from('picks')
        .insert({
          user_id: user.id,
          team_id,
          round_id,
          tournament_id,
          result: 'pending'
        })
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        pick: data[0]
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
