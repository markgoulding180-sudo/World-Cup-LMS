// Vercel Function: Reset + Setup Tournament
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

  if (admin_pin !== '1234') {
    return res.status(401).json({ error: 'Invalid admin PIN' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET
  );

  // ─────────────────────────────────────────────────────────
  // SHARED HELPER — clears all game data
  // Safe to call from both reset and setup actions
  // NEVER touches: master_teams, users, master_clock, auth.users
  // ─────────────────────────────────────────────────────────
  async function clearGameData() {
    const FAKE_ID = '00000000-0000-0000-0000-000000000000';
    await supabase.from('picks').delete().neq('id', FAKE_ID);
    await supabase.from('tournament_entries').delete().neq('id', FAKE_ID);
    await supabase.from('matches').delete().neq('id', FAKE_ID);
    await supabase.from('rounds').delete().neq('id', FAKE_ID);
    await supabase.from('tournaments').delete().neq('id', FAKE_ID);
    await supabase.from('teams').delete().neq('id', FAKE_ID);

    // Reset master_clock to round 1 (update, not delete)
    await supabase.from('master_clock').upsert({
      id: 'current',
      current_round: 1,
      current_matchday: 1,
      status: 'upcoming'
    });
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: reset
  // Just clears data. Does NOT rebuild anything.
  // Kept as a safety option but Setup Tournament does this automatically.
  // ─────────────────────────────────────────────────────────
  if (action === 'reset') {
    if (confirm !== 'RESET') {
      return res.status(400).json({ error: 'Send confirm: "RESET" to proceed' });
    }

    try {
      await clearGameData();

      return res.status(200).json({
        success: true,
        message: 'All game data cleared. master_teams and user accounts preserved. Ready for Setup Tournament.'
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: setup
  // Clears ALL game data first, then rebuilds from scratch.
  // Safe to run repeatedly — clears before inserting every time.
  // NEVER touches master_teams, users, or auth.users.
  // ─────────────────────────────────────────────────────────
  if (action === 'setup') {
    try {

      // Step 1 — Clear all game data first (safe to run on repeat)
      await clearGameData();

      // Step 2 — Create the tournament
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

      // Step 3 — Copy all teams from master_teams into teams
      // master_teams is NEVER cleared — it is the permanent source of flag images
      const { data: masterTeams, error: masterError } = await supabase
        .from('master_teams')
        .select('*');

      if (masterError) {
        return res.status(500).json({ error: 'Failed to read master_teams: ' + masterError.message });
      }

      if (!masterTeams || masterTeams.length === 0) {
        return res.status(500).json({ error: 'master_teams is empty — flag image data is missing. Cannot set up.' });
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

      // Step 4 — Create all 6 rounds
      const { error: roundsError } = await supabase.from('rounds').insert([
        { name: 'Group Stage',     round_number: 1, picks_required: 9, status: 'open' },
        { name: 'Round of 32',    round_number: 2, picks_required: 1, status: 'upcoming' },
        { name: 'Round of 16',    round_number: 3, picks_required: 1, status: 'upcoming' },
        { name: 'Quarter Finals', round_number: 4, picks_required: 1, status: 'upcoming' },
        { name: 'Semi Finals',    round_number: 5, picks_required: 1, status: 'upcoming' },
        { name: 'Final',          round_number: 6, picks_required: 1, status: 'upcoming' }
      ]);

      if (roundsError) {
        return res.status(500).json({ error: 'Failed to create rounds: ' + roundsError.message });
      }

      // Step 5 — Set master clock to round 1 active
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
        message: `All old data cleared. Tournament created. ${masterTeams.length} teams copied from master data. 6 rounds set up. Group Stage is open. Next: Import match schedule.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action. Use "reset" or "setup".' });
};
