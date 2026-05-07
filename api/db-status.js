// Vercel Function: Check database status
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

    // Check all tables
    const [
      { data: teams, error: teamsError },
      { data: users, error: usersError },
      { data: matches, error: matchesError },
      { data: rounds, error: roundsError },
      { data: tournaments, error: tournamentsError }
    ] = await Promise.all([
      supabase.from('teams').select('count'),
      supabase.from('users').select('count'),
      supabase.from('matches').select('count'),
      supabase.from('rounds').select('count'),
      supabase.from('tournaments').select('count')
    ]);

    // Get sample data
    const { data: sampleTeams } = await supabase.from('teams').select('name, group_name').limit(5);
    const { data: sampleUsers } = await supabase.from('users').select('username, email').limit(5);
    const { data: sampleMatches } = await supabase.from('matches').select('match_time, status').limit(3);

    return res.status(200).json({
      status: 'ok',
      counts: {
        teams: teams?.[0]?.count || 0,
        users: users?.[0]?.count || 0,
        matches: matches?.[0]?.count || 0,
        rounds: rounds?.[0]?.count || 0,
        tournaments: tournaments?.[0]?.count || 0
      },
      samples: {
        teams: sampleTeams,
        users: sampleUsers,
        matches: sampleMatches
      },
      errors: {
        teams: teamsError?.message,
        users: usersError?.message,
        matches: matchesError?.message,
        rounds: roundsError?.message,
        tournaments: tournamentsError?.message
      }
    });

  } catch (error) {
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};
