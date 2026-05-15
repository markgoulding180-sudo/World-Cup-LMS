// Vercel Function: Reset All Data + Setup Tournament
const { createClient } = require('@supabase/supabase-js');

const FIXTURE_URL = 'https://fixturedownload.com/feed/json/fifa-world-cup-2026';
const FAKE_ID = '00000000-0000-0000-0000-000000000000';

const TEAM_MAPPINGS = {
  'Korea Republic': 'South Korea',
  'Czechia': 'Czech Republic',
  'IR Iran': 'Iran',
  'Türkiye': 'Turkey',
  'Congo DR': 'DR Congo',
  'Cabo Verde': 'Cape Verde',
  "Côte d'Ivoire": 'Ivory Coast',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'USA': 'United States',
  'United States': 'USA'  // Bidirectional mapping for flexibility
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
  // ACTION: reset
  // Clears EVERYTHING including auth accounts
  // Only master_teams is preserved
  // ─────────────────────────────────────────────────────────
  if (action === 'reset') {
    if (confirm !== 'RESET') {
      return res.status(400).json({ error: 'Send confirm: "RESET" to proceed' });
    }

    try {
      // Delete game data in FK-safe order (children before parents)
      await supabase.from('picks').delete().neq('id', FAKE_ID);
      await supabase.from('tournament_entries').delete().neq('id', FAKE_ID);
      await supabase.from('matches').delete().neq('id', FAKE_ID);
      await supabase.from('rounds').delete().neq('id', FAKE_ID);
      await supabase.from('tournaments').delete().neq('id', FAKE_ID);
      await supabase.from('teams').delete().neq('id', FAKE_ID);
      await supabase.from('users').delete().neq('id', FAKE_ID);

      // Reset master_clock row to defaults (update not delete)
      await supabase.from('master_clock').upsert({
        id: 'current',
        current_round: 1,
        current_matchday: 1,
        status: 'upcoming'
      });

      // Delete all Supabase auth accounts
      const { data: { users: authUsers }, error: listError } = await supabase.auth.admin.listUsers();
      if (!listError && authUsers) {
        for (const user of authUsers) {
          await supabase.auth.admin.deleteUser(user.id);
        }
      }

      return res.status(200).json({
        success: true,
        authAccountsDeleted: authUsers?.length || 0,
        message: `All data cleared including ${authUsers?.length || 0} auth account(s). Only master_teams preserved. Now click Setup Tournament.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: setup
  // Creates tournament, copies teams, creates rounds,
  // imports matches — all in one go
  // ─────────────────────────────────────────────────────────
  if (action === 'setup') {
    try {

      // Step 1 — Create tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          name: 'World Cup 2026 Last Man Standing',
          entry_fee: 30,
          prize_pool: 0,
          max_players: 100,
          current_players: 0,
          lives: 3,
          status: 'open'
        })
        .select()
        .single();

      if (tournamentError) {
        return res.status(500).json({ error: 'Failed to create tournament: ' + tournamentError.message });
      }

      // Step 2 — Copy teams from master_teams (never cleared — has flag URLs)
      const { data: masterTeams, error: masterError } = await supabase
        .from('master_teams')
        .select('*');

      if (masterError || !masterTeams || masterTeams.length === 0) {
        return res.status(500).json({ error: 'master_teams is empty or unreadable. Flag image data is missing.' });
      }

      const { error: teamsError } = await supabase.from('teams').insert(
        masterTeams.map(t => ({
          name: t.name,
          code: t.code,
          flag_url: t.flag_url,
          group_name: t.group_name
        }))
      );

      if (teamsError) {
        return res.status(500).json({ error: 'Failed to insert teams: ' + teamsError.message });
      }

      // Step 3 — Create all 6 rounds
      const { error: roundsError } = await supabase.from('rounds').insert([
        { name: 'Group Stage', round_number: 1, picks_required: 9, status: 'open' },
        { name: 'Round of 32', round_number: 2, picks_required: 1, status: 'upcoming' },
        { name: 'Round of 16', round_number: 3, picks_required: 1, status: 'upcoming' },
        { name: 'Quarter Finals', round_number: 4, picks_required: 1, status: 'upcoming' },
        { name: 'Semi Finals', round_number: 5, picks_required: 1, status: 'upcoming' },
        { name: 'Final', round_number: 6, picks_required: 1, status: 'upcoming' }
      ]);

      if (roundsError) {
        return res.status(500).json({ error: 'Failed to create rounds: ' + roundsError.message });
      }

      // Step 4 — Import match schedule from fixturedownload.com
      const fixtureResponse = await fetch(FIXTURE_URL);
      const fixtures = await fixtureResponse.json();

      // Get teams and rounds we just inserted for ID lookups
      const { data: insertedTeams } = await supabase.from('teams').select('id, name');
      const teamLookup = new Map(insertedTeams.map(t => [t.name, t.id]));

      const { data: insertedRounds } = await supabase.from('rounds').select('id, round_number');
      const roundLookup = new Map(insertedRounds.map(r => [r.round_number, r.id]));

      // Group stage = RoundNumber 1, 2, 3 from fixturedownload
      const groupStageFixtures = fixtures.filter(f => f.RoundNumber >= 1 && f.RoundNumber <= 3);

      const matches = [];
      const missingTeams = [];

      for (const match of groupStageFixtures) {
        // Map API names to our team names (bidirectional)
        let homeName = TEAM_MAPPINGS[match.HomeTeam] || match.HomeTeam;
        let awayName = TEAM_MAPPINGS[match.AwayTeam] || match.AwayTeam;
        
        // Try to find team ID
        let homeTeamId = teamLookup.get(homeName);
        let awayTeamId = teamLookup.get(awayName);
        
        // If not found, try reverse mapping
        if (!homeTeamId) {
          const reverseHome = Object.entries(TEAM_MAPPINGS).find(([k, v]) => v === homeName)?.[0];
          if (reverseHome) homeTeamId = teamLookup.get(reverseHome);
        }
        if (!awayTeamId) {
          const reverseAway = Object.entries(TEAM_MAPPINGS).find(([k, v]) => v === awayName)?.[0];
          if (reverseAway) awayTeamId = teamLookup.get(reverseAway);
        }

        if (!homeTeamId) { missingTeams.push(`${match.HomeTeam} (tried: ${homeName})`); continue; }
        if (!awayTeamId) { missingTeams.push(`${match.AwayTeam} (tried: ${awayName})`); continue; }

        matches.push({
          round_id: roundLookup.get(1),
          matchday: match.RoundNumber,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          match_time: match.DateUtc,
          status: 'upcoming'
        });
      }

      if (matches.length > 0) {
        const { error: matchError } = await supabase.from('matches').insert(matches);
        if (matchError) {
          return res.status(500).json({ error: 'Failed to insert matches: ' + matchError.message });
        }
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
        teamsAdded: masterTeams.length,
        matchesImported: matches.length,
        missingTeams: missingTeams.length > 0 ? [...new Set(missingTeams)] : null,
        message: `Tournament ready. ${masterTeams.length} teams, 6 rounds, ${matches.length} matches imported. Group Stage is open. Users can now register and enter.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: simulate
  // Creates 100 test users with tournament entries and picks
  // Uses batch inserts for speed (avoids Vercel timeout)
  // ─────────────────────────────────────────────────────────
  if (action === 'simulate') {
    try {
      const tournament = await supabase.from('tournaments').select('id').single();
      const round = await supabase.from('rounds').select('id').eq('round_number', 1).single();
      
      if (!tournament.data || !round.data) {
        return res.status(400).json({ error: 'Tournament or Group Stage round not found. Run Setup first.' });
      }

      const tournamentId = tournament.data.id;
      const roundId = round.data.id;
      
      // Get all teams for each matchday upfront
      const { data: md1Teams } = await supabase.from('matches').select('home_team_id, away_team_id').eq('matchday', 1);
      const { data: md2Teams } = await supabase.from('matches').select('home_team_id, away_team_id').eq('matchday', 2);
      const { data: md3Teams } = await supabase.from('matches').select('home_team_id, away_team_id').eq('matchday', 3);
      
      const md1Pool = md1Teams.flatMap(m => [m.home_team_id, m.away_team_id]);
      const md2Pool = md2Teams.flatMap(m => [m.home_team_id, m.away_team_id]);
      const md3Pool = md3Teams.flatMap(m => [m.home_team_id, m.away_team_id]);
      
      // Prepare batch arrays
      const users = [];
      const entries = [];
      const picks = [];
      
      // Generate all data in memory first
      for (let i = 1; i <= 100; i++) {
        const userId = crypto.randomUUID ? crypto.randomUUID() : `sim-${Date.now()}-${i}`;
        
        users.push({
          id: userId,
          username: `player${i}`,
          display_name: `Player ${i}`,
          email: `player${i}@test.com`
        });
        
        entries.push({
          tournament_id: tournamentId,
          user_id: userId,
          status: 'active',
          lives_remaining: 3,
          max_lives: 3
        });
        
        // Random picks for each matchday
        [md1Pool, md2Pool, md3Pool].forEach((pool, idx) => {
          const shuffled = [...pool].sort(() => 0.5 - Math.random());
          const selected = shuffled.slice(0, 3);
          
          selected.forEach(teamId => {
            picks.push({
              tournament_id: tournamentId,
              user_id: userId,
              round_id: roundId,
              team_id: teamId,
              matchday: idx + 1,
              result: 'pending'
            });
          });
        });
      }
      
      // Batch insert in chunks to avoid payload limits
      const chunkSize = 50;
      let userErrors = 0;
      let entryErrors = 0;
      let pickErrors = 0;
      
      for (let i = 0; i < users.length; i += chunkSize) {
        const { error } = await supabase.from('users').insert(users.slice(i, i + chunkSize));
        if (error) userErrors++;
      }
      
      for (let i = 0; i < entries.length; i += chunkSize) {
        const { error } = await supabase.from('tournament_entries').insert(entries.slice(i, i + chunkSize));
        if (error) entryErrors++;
      }
      
      for (let i = 0; i < picks.length; i += chunkSize) {
        const { error } = await supabase.from('picks').insert(picks.slice(i, i + chunkSize));
        if (error) pickErrors++;
      }
      
      // Verify actual counts
      const { count: actualUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const { count: actualEntries } = await supabase.from('tournament_entries').select('*', { count: 'exact', head: true });
      const { count: actualPicks } = await supabase.from('picks').select('*', { count: 'exact', head: true });

      return res.status(200).json({
        success: true,
        usersCreated: users.length,
        entriesCreated: entries.length,
        totalPicks: picks.length,
        actualUsers,
        actualEntries,
        actualPicks,
        errors: { userErrors, entryErrors, pickErrors },
        message: `Simulation complete. ${users.length} users, ${entries.length} entries, ${picks.length} picks. Actual in DB: ${actualUsers} users, ${actualEntries} entries, ${actualPicks} picks.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action. Use "reset", "setup", or "simulate".' });
};
