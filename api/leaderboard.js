// Vercel Function: Get Leaderboard
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // Get active players
    const { data: active, error: activeError } = await supabase
      .from('tournament_entries')
      .select('*, users:user_id(display_name)')
      .eq('status', 'active')
      .order('entered_at', { ascending: true });

    // Get eliminated players
    const { data: eliminated, error: elimError } = await supabase
      .from('tournament_entries')
      .select('*, users:user_id(display_name)')
      .eq('status', 'eliminated')
      .order('eliminated_at', { ascending: false });

    if (activeError || elimError) {
      return res.status(500).json({ error: activeError?.message || elimError?.message });
    }

    return res.status(200).json({
      active: active || [],
      eliminated: eliminated || []
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
