// Vercel Function: Get Tournament Entry Status
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

  // GET - Fetch user's entry status
  if (req.method === 'GET') {
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

      // Get user's tournament entry
      const { data: entries, error } = await supabase
        .from('tournament_entries')
        .select('*, tournaments:tournament_id(*)')
        .eq('user_id', user.id)
        .order('entered_at', { ascending: false })
        .limit(1);

      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      const entry = entries && entries.length > 0 ? entries[0] : null;

      // Get current round from master clock
      const { data: clock } = await supabase
        .from('master_clock')
        .select('*')
        .eq('id', 'current')
        .single();

      return res.status(200).json({
        status: entry?.status || 'not_entered',
        entry: entry || null,
        current_round: clock?.current_round || 1,
        eliminated_round: entry?.eliminated_round || null
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Enter tournament
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

      const { tournament_id } = req.body;

      const { data, error } = await supabase
        .from('tournament_entries')
        .insert({
          user_id: user.id,
          tournament_id,
          status: 'active'
        })
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        entry: data[0]
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
