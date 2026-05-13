// Vercel Function: Get Teams
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
      process.env.SUPABASE_SECRET  // Fixed: was SUPABASE_KEY
    );

    const { data: teams, error } = await supabase
      .from('teams')
      .select('*')
      .order('group_name', { ascending: true })
      .order('name', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ teams: teams || [] });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
