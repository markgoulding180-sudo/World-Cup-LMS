// Vercel Function: Leaderboard
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

    // Get all tournament entries with user info
    const { data: entries, error } = await supabase
      .from('tournament_entries')
      .select(`
        *,
        users:user_id(username, display_name)
      `)
      .order('entered_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Get all picks for context
    const { data: picks } = await supabase
      .from('picks')
      .select(`
        *,
        teams:team_id(name, flag_url)
      `)
      .order('created_at', { ascending: false });

    // Calculate stats
    const totalPlayers = entries?.length || 0;
    const activePlayers = entries?.filter(e => e.status === 'active').length || 0;
    const eliminatedPlayers = entries?.filter(e => e.status === 'eliminated').length || 0;

    // Build leaderboard data
    const leaderboard = entries?.map((entry, index) => {
      const userPicks = picks?.filter(p => p.user_id === entry.user_id) || [];
      const latestPick = userPicks[0];
      
      return {
        position: entry.status === 'active' ? null : index + 1,
        username: entry.users?.username || 'Unknown',
        display_name: entry.users?.display_name || 'Unknown',
        status: entry.status,
        eliminated_round: entry.eliminated_round,
        entered_at: entry.entered_at,
        current_pick: latestPick ? {
          team: latestPick.teams?.name,
          flag: latestPick.teams?.flag_url,
          result: latestPick.result
        } : null
      };
    });

    // Sort: active first (by entry date), then eliminated (by elimination round desc)
    const sortedLeaderboard = leaderboard?.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      if (a.status === 'active' && b.status === 'active') {
        return new Date(a.entered_at) - new Date(b.entered_at);
      }
      return (b.eliminated_round || 0) - (a.eliminated_round || 0);
    });

    // Assign positions
    sortedLeaderboard?.forEach((player, index) => {
      if (player.status === 'active') {
        player.position = index + 1;
      }
    });

    return res.status(200).json({
      success: true,
      stats: {
        total_players: totalPlayers,
        active_players: activePlayers,
        eliminated_players: eliminatedPlayers
      },
      leaderboard: sortedLeaderboard || []
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
