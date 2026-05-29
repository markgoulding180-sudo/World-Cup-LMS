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

      return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};