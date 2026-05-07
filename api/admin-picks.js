// Vercel Function: Admin - Get all picks
const { createClient } = require('@supabase/supabase-js');

const ADMIN_PIN = '1234'; // Simple PIN check

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

    // Get all picks with user and team info
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
      console.error('Picks error:', error);
      return res.status(500).json({ error: 'Failed to fetch picks', details: error.message });
    }

    // Get summary stats
    const { data: stats } = await supabase
      .from('picks')
      .select('result', { count: 'exact' });

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

  } catch (error) {
    console.error('Admin picks error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};
