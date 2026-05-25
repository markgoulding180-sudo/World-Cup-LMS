// Vercel Function: Leaderboard - Points-based System
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

    // Get current tournament ID
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const tournamentId = tournament?.id;
    
    if (!tournamentId) {
      return res.status(200).json({ success: true, stats: { total_players: 0, active_players: 0 }, leaderboard: [] });
    }

    // Get tournament entries for current tournament only
    const { data: entries, error } = await supabase
      .from('tournament_entries')
      .select(`
        *,
        users:user_id(username, display_name)
      `)
      .eq('tournament_id', tournamentId)
      .order('total_points', { ascending: false })
      .order('wins', { ascending: false })
      .order('entered_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Get all picks for current tournament only
    const { data: picks } = await supabase
      .from('picks')
      .select(`
        *,
        teams:team_id(name, flag_url),
        rounds:round_id(round_number, name)
      `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    // Calculate stats
    const totalPlayers = entries?.length || 0;
    const activePlayers = entries?.filter(e => e.status === 'active').length || 0;
    
    // Calculate prize pool (£30 per player)
    const entryFee = 30;
    const prizePool = totalPlayers * entryFee;

    // Find the highest round number that has picks (to determine current round)
    const allRoundNumbers = picks?.map(p => p.rounds?.round_number || 1) || [];
    const maxRound = Math.max(...allRoundNumbers, 1);
    
    // Build leaderboard data - sorted by points already from DB query
    const leaderboard = entries?.map((entry, index) => {
      const userPicks = picks?.filter(p => p.user_id === entry.user_id) || [];
      const wins = userPicks.filter(p => p.result === 'win').length;
      
      // Group picks by round
      const roundNames = { 1: 'GS', 2: 'L32', 3: 'L16', 4: 'QF', 5: 'SF', 6: 'F' };
      const picksByRound = {};
      const userRoundNumbers = new Set();
      
      userPicks.forEach(p => {
        const roundNum = p.rounds?.round_number || 1;
        userRoundNumbers.add(roundNum);
        const roundLabel = roundNames[roundNum] || 'GS';
        if (!picksByRound[roundLabel]) {
          picksByRound[roundLabel] = [];
        }
        picksByRound[roundLabel].push({
          team: p.teams?.name,
          flag: p.teams?.flag_url,
          result: p.result,
          points: p.points
        });
      });
      
      // Determine if player is eliminated (missed the most recent round)
      // If maxRound > 1 and player has no pick in maxRound, they're out
      const hasPickInMaxRound = userRoundNumbers.has(maxRound);
      const isEliminated = maxRound > 1 && !hasPickInMaxRound;
      
      return {
        position: index + 1,
        username: entry.users?.username || 'Unknown',
        display_name: entry.users?.display_name || 'Unknown',
        status: isEliminated ? 'eliminated' : entry.status,
        total_points: entry.total_points || 0,
        wins: wins,
        entered_at: entry.entered_at,
        current_pick: userPicks[0] ? {
          team: userPicks[0].teams?.name,
          flag: userPicks[0].teams?.flag_url,
          result: userPicks[0].result,
          points: userPicks[0].points
        } : null,
        picks_by_round: picksByRound
      };
    });

    // Get current round name
    const roundNames = { 1: 'Group Stage', 2: 'Round of 32', 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
    const currentRoundName = roundNames[maxRound] || 'Group Stage';
    
    return res.status(200).json({
      success: true,
      stats: {
        total_players: totalPlayers,
        active_players: activePlayers,
        prize_pool: prizePool,
        current_round: currentRoundName
      },
      leaderboard: leaderboard || []
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
