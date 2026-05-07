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

  // GET - List rounds
  if (req.method === 'GET') {
    try {
      const { data: rounds, error } = await supabase
        .from('rounds')
        .select('*')
        .order('round_number', { ascending: true });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ rounds: rounds || [] });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Open/close round
  if (req.method === 'POST') {
    try {
      const { action, round_id } = req.body;

      const newStatus = action === 'open' ? 'open' : 'closed';

      const { data, error } = await supabase
        .from('rounds')
        .update({ status: newStatus })
        .eq('id', round_id)
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        round: data[0]
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
