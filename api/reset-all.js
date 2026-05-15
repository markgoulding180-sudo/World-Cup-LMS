// Vercel Function: Reset all data + Tournament Setup
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Body parser
  if (!req.body) {
    await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        try { req.body = JSON.parse(data); } catch { req.body = {}; }
        resolve();
      });
    });
  }

  const { action, confirm, admin_pin } = req.body || {};

  // PIN check applies to both actions
  if (admin_pin !== '1234') {
    return res.status(401).json({ error: 'Invalid admin PIN' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET
  );

  // ─────────────────────────────────────────
  // ACTION: reset
  // Wipes all game data except master_teams
  // ─────────────────────────────────────────
  if (action === 'reset') {

    if (confirm !== 'RESET') {
      return res.status(400).json({ error: 'Confirmation required. Send confirm: "RESET"' });
    }

    try {
      // Delete in FK-safe order (children before parents)
      await supabase.from('picks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('tournament_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('rounds').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Reset master_clock to defaults
      await supabase.from('master_clock').upsert({
        id: 'current',
        current_round: 1,
        current_matchday: 1,
        status: 'upcoming'
      });

      // Re-sync public users from auth so existing users don't break
      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
      for (const user of authUsers || []) {
        await supabase.from('users').upsert({
          id: user.id,
          username: user.email.split('@')[0].slice(0, 20),
          display_name: user.email.split('@')[0].slice(0, 20),
          email: user.email
        }, { onConflict: 'id' });
      }

      return res.status(200).json({
        success: true,
        message: `All game data cleared. ${authUsers?.length || 0} user(s) re-synced. Ready for tournament setup.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────
  // ACTION: setup
  // Creates tournament, copies teams, creates rounds
  // ─────────────────────────────────────────
  if (action === 'setup') {

    try {
      // Check tournament doesn't already exist
      const { data: existing } = await supabase
        .from('tournaments')
        .select('id')
        .limit(1);

      if (existing && existing.length > 0) {
        return res.status(400).json({
          error: 'A tournament already exists. Run a reset first before setting up again.'
        });
      }

      // 1. Create the tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          name: 'World Cup 2026 Last Man Standing',
          entry_fee: 30,
          prize_pool: 0,
          max_players: 100,
          current_players: 0,
          lives: 9,
          status: 'open'
        })
        .select()
        .single();

      if (tournamentError) {
        return res.status(500).json({ error: 'Failed to create tournament: ' + tournamentError.message });
      }

      // 2. Copy teams from master_teams into teams table
      const { data: masterTeams, error: masterError } = await supabase
        .from('master_teams')
        .select('*');

      if (masterError) {
        return res.status(500).json({ error: 'Failed to read master_teams: ' + masterError.message });
      }

      const teamsToInsert = masterTeams.map(t => ({
        name: t.name,
        code: t.code,
        flag_url: t.flag_url,
        group_name: t.group_name
      }));

      const { error: teamsError } = await supabase.from('teams').insert(teamsToInsert);
      if (teamsError) {
        return res.status(500).json({ error: 'Failed to insert teams: ' + teamsError.message });
      }

      // 3. Create all rounds
      const { error: roundsError } = await supabase.from('rounds').insert([
        { name: 'Group Stage',    round_number: 1, picks_required: 9, status: 'open' },
        { name: 'Round of 32',   round_number: 2, picks_required: 1, status: 'upcoming' },
        { name: 'Round of 16',   round_number: 3, picks_required: 1, status: 'upcoming' },
        { name: 'Quarter Finals', round_number: 4, picks_required: 1, status: 'upcoming' },
        { name: 'Semi Finals',   round_number: 5, picks_required: 1, status: 'upcoming' },
        { name: 'Final',         round_number: 6, picks_required: 1, status: 'upcoming' }
      ]);

      if (roundsError) {
        return res.status(500).json({ error: 'Failed to create rounds: ' + roundsError.message });
      }

      // 4. Set master clock to round 1 active
      await supabase.from('master_clock').upsert({
        id: 'current',
        current_round: 1,
        current_matchday: 1,
        status: 'active'
      });

      return res.status(200).json({
        success: true,
        tournament: tournament,
        teamsAdded: masterTeams.length,
        message: `Tournament created. ${masterTeams.length} teams copied. 6 rounds set up. Group Stage is open. Next: Import match schedule.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action. Use "reset" or "setup".' });
};
