// Vercel Function: Get/Create Tournaments
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

  // GET - List tournaments
  if (req.method === 'GET') {
    try {
      const { data: tournaments, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ 
        tournaments: tournaments || [],
        count: tournaments?.length || 0
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Create tournament
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

      const { name, entry_fee, prize_pool, max_players, lives = 3 } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Tournament name is required' });
      }

      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          name,
          entry_fee: entry_fee || 0,
          prize_pool: prize_pool || 0,
          max_players: max_players || null,
          lives: lives || 3,
          status: 'upcoming'
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        tournament: data
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
