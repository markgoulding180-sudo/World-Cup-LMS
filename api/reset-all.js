// Vercel Function: Reset All Data + Setup Tournament + Simulation
const { createClient } = require('@supabase/supabase-js');

const FOOTBALL_DATA_URL = 'https://api.football-data.org/v4/competitions/WC/matches?season=2026';
const FOOTBALL_DATA_TOKEN = 'aef925b3b2df4c6e922f08a5498bdab0';
const FAKE_ID = '00000000-0000-0000-0000-000000000000';

const TEAM_MAPPINGS = {
  'Korea Republic': 'South Korea',
  'Czechia': 'Czech Republic',
  'IR Iran': 'Iran',
  'Türkiye': 'Turkey',
  'Congo DR': 'DR Congo',
  'Cabo Verde': 'Cape Verde',
  'Cape Verde Islands': 'Cape Verde',
  "Côte d'Ivoire": 'Ivory Coast',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
  'USA': 'United States',
  'Korea DPR': 'North Korea',
  'Kyrgyz Republic': 'Kyrgyzstan'
};

// Points structure for each round
const POINTS_STRUCTURE = {
  1: 2,  // Group Stage = 2 points
  2: 4,  // Round of 32 = 4 points
  3: 6,  // Round of 16 = 6 points
  4: 8,  // Quarter Finals = 8 points
  5: 10, // Semi Finals = 10 points
  6: 15  // Final = 15 points
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  const { action, confirm: confirmVal, admin_pin } = req.body || {};

  if (admin_pin !== '1234') return res.status(401).json({ error: 'Invalid admin PIN' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET);

  async function calculateGroupStandings() {
    const { data: teams } = await supabase.from('teams').select('id, name, group_name');
    const { data: matches } = await supabase.from('matches').select('home_team_id, away_team_id, home_score, away_score, result').eq('status', 'finished').in('matchday', [1, 2, 3]);
    const standings = {};
    teams.forEach(t => { standings[t.id] = { id: t.id, name: t.name, group_name: t.group_name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }; });
    matches.forEach(m => {
      const home = standings[m.home_team_id]; const away = standings[m.away_team_id];
      if (!home || !away) return;
      home.played++; away.played++;
      home.gf += m.home_score || 0; home.ga += m.away_score || 0;
      away.gf += m.away_score || 0; away.ga += m.home_score || 0;
      if (m.result === 'H') { home.won++; home.points += 3; away.lost++; }
      else if (m.result === 'A') { away.won++; away.points += 3; home.lost++; }
      else { home.drawn++; home.points++; away.drawn++; away.points++; }
    });
    const groups = {};
    Object.values(standings).forEach(t => { if (!groups[t.group_name]) groups[t.group_name] = []; groups[t.group_name].push(t); });
    const sortFn = (a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf;
    Object.values(groups).forEach(g => g.sort(sortFn));
    return { groups, standings };
  }

  async function get32QualifiedTeams() {
    const { groups } = await calculateGroupStandings();
    const top2 = []; const thirdPlace = [];
    Object.values(groups).forEach(g => {
      if (g.length >= 1) top2.push(g[0]);
      if (g.length >= 2) top2.push(g[1]);
      if (g.length >= 3) thirdPlace.push(g[2]);
    });
    const sortFn = (a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf;
    thirdPlace.sort(sortFn);
    return [...top2, ...thirdPlace.slice(0, 8)];
  }

  // ── RESET ──────────────────────────────────────────────────
  if (action === 'reset') {
    if (confirmVal !== 'RESET') return res.status(400).json({ error: 'Send confirm: "RESET"' });
    try {
      // Get all admin user IDs first
      const { data: adminUsers } = await supabase.from('users').select('id').eq('is_admin', true);
      const adminIds = adminUsers?.map(u => u.id) || [];
      
      // Delete all picks except from admins
      if (adminIds.length > 0) {
        await supabase.from('picks').delete().not('user_id', 'in', `(${adminIds.join(',')})`);
      } else {
        await supabase.from('picks').delete().neq('id', FAKE_ID);
      }
      
      // Delete all tournament entries except from admins
      if (adminIds.length > 0) {
        await supabase.from('tournament_entries').delete().not('user_id', 'in', `(${adminIds.join(',')})`);
      } else {
        await supabase.from('tournament_entries').delete().neq('id', FAKE_ID);
      }
      
      await supabase.from('matches').delete().neq('id', FAKE_ID);
      await supabase.from('rounds').delete().neq('id', FAKE_ID);
      await supabase.from('tournaments').delete().neq('id', FAKE_ID);
      await supabase.from('teams').delete().neq('id', FAKE_ID);
      
      // Delete users except admins
      if (adminIds.length > 0) {
        await supabase.from('users').delete().not('id', 'in', `(${adminIds.join(',')})`);
      } else {
        await supabase.from('users').delete().neq('id', FAKE_ID);
      }
      
      await supabase.from('master_clock').upsert({ id: 'current', current_round: 1, current_matchday: 1, status: 'upcoming' });
      
      // Delete auth users except admins
      const { data: { users: authUsers }, error: listError } = await supabase.auth.admin.listUsers();
      let deletedCount = 0;
      if (!listError && authUsers) { 
        for (const u of authUsers) {
          if (!adminIds.includes(u.id)) {
            await supabase.auth.admin.deleteUser(u.id);
            deletedCount++;
          }
        }
      }
      return res.status(200).json({ success: true, authAccountsDeleted: deletedCount, adminUsersPreserved: adminIds.length, message: `All data cleared except ${adminIds.length} admin user(s). ${deletedCount} auth account(s) deleted.` });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SETUP ──────────────────────────────────────────────────
  if (action === 'setup') {
    try {
      // Count admin users
      const { data: adminUsers } = await supabase.from('users').select('id').eq('is_admin', true);
      const adminCount = adminUsers?.length || 0;

      const { data: tournament, error: tErr } = await supabase.from('tournaments').insert({ name: 'World Cup 2026 Last Man Standing', entry_fee: 30, prize_pool: 0, max_players: 100, current_players: 0, status: 'open' }).select().single();
      if (tErr) return res.status(500).json({ error: 'Failed to create tournament: ' + tErr.message });

      const { data: masterTeams, error: mErr } = await supabase.from('master_teams').select('*');
      if (mErr || !masterTeams?.length) return res.status(500).json({ error: 'master_teams empty or unreadable.' });

      const { error: teamsErr } = await supabase.from('teams').insert(masterTeams.map(t => ({ name: t.name, code: t.code, flag_url: t.flag_url, group_name: t.group_name })));
      if (teamsErr) return res.status(500).json({ error: 'Failed to insert teams: ' + teamsErr.message });

      const { error: roundsErr } = await supabase.from('rounds').insert([
        { name: 'Group Stage', round_number: 1, picks_required: 9, status: 'open' },
        { name: 'Round of 32', round_number: 2, picks_required: 1, status: 'upcoming' },
        { name: 'Round of 16', round_number: 3, picks_required: 1, status: 'upcoming' },
        { name: 'Quarter Finals', round_number: 4, picks_required: 1, status: 'upcoming' },
        { name: 'Semi Finals', round_number: 5, picks_required: 1, status: 'upcoming' },
        { name: 'Final', round_number: 6, picks_required: 1, status: 'upcoming' }
      ]);
      if (roundsErr) return res.status(500).json({ error: 'Failed to create rounds: ' + roundsErr.message });

      // Fetch fixtures from football-data.org (single source of truth)
      const fixtureResp = await fetch(FOOTBALL_DATA_URL, {
        headers: { 'X-Auth-Token': FOOTBALL_DATA_TOKEN }
      });
      
      if (!fixtureResp.ok) {
        const errorText = await fixtureResp.text();
        return res.status(500).json({ error: `football-data.org API error: ${fixtureResp.status} — ${errorText}` });
      }
      
      const apiData = await fixtureResp.json();
      const fixtures = apiData.matches || [];
      
      const { data: insertedTeams } = await supabase.from('teams').select('id, name');
      const teamLookup = new Map();
      insertedTeams?.forEach(t => {
        teamLookup.set(t.name, t.id);
        teamLookup.set(t.name.toLowerCase(), t.id);
      });
      
      const { data: insertedRounds } = await supabase.from('rounds').select('id, round_number');
      const roundLookup = new Map(insertedRounds.map(r => [r.round_number, r.id]));

      const matches = []; 
      const missingTeams = [];
      
      // Group stage matches are those with stage === 'GROUP_STAGE'
      const groupStageMatches = fixtures.filter(f => f.stage === 'GROUP_STAGE');
      
      for (const m of groupStageMatches) {
        const homeName = TEAM_MAPPINGS[m.homeTeam?.name] || m.homeTeam?.name;
        const awayName = TEAM_MAPPINGS[m.awayTeam?.name] || m.awayTeam?.name;
        
        // Try to find team ID with various name formats
        let homeId = teamLookup.get(homeName) || teamLookup.get(homeName?.toLowerCase());
        let awayId = teamLookup.get(awayName) || teamLookup.get(awayName?.toLowerCase());
        
        if (!homeId) { missingTeams.push(m.homeTeam?.name || 'Unknown'); continue; }
        if (!awayId) { missingTeams.push(m.awayTeam?.name || 'Unknown'); continue; }
        
        // matchday comes from the group name (e.g., "GROUP_A" -> matchday 1, 2, or 3)
        // We'll use the matchday field if available, otherwise infer from match count per group
        const matchday = m.matchday || 1;
        
        matches.push({ 
          round_id: roundLookup.get(1), 
          matchday: matchday, 
          home_team_id: homeId, 
          away_team_id: awayId, 
          match_time: m.utcDate, 
          status: 'upcoming' 
        });
      }
      
      if (matches.length > 0) { 
        const { error: matchErr } = await supabase.from('matches').insert(matches); 
        if (matchErr) return res.status(500).json({ error: 'Failed to insert matches: ' + matchErr.message }); 
      }
      
      await supabase.from('master_clock').upsert({ id: 'current', current_round: 1, current_matchday: 1, status: 'active' });
      
      return res.status(200).json({ 
        success: true, 
        teamsAdded: masterTeams.length, 
        matchesImported: matches.length, 
        missingTeams: missingTeams.length > 0 ? [...new Set(missingTeams)] : null,
        adminUsers: adminCount,
        message: `Tournament ready. ${masterTeams.length} teams, 6 rounds, ${matches.length} group stage matches imported from football-data.org. ${adminCount} admin user(s) preserved.` 
      });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SIMULATE USERS (step-by-step) ─────────────────────────
  if (action === 'simulate_users') {
    const { batch = 0 } = req.body;
    try {
      const { data: t } = await supabase.from('tournaments').select('id').single();
      if (!t) return res.status(400).json({ error: 'No tournament found.' });
      let registered = 0; let entered = 0;
      let testUserCredentials = null;
      
      for (let i = batch * 10 + 1; i <= batch * 10 + 10; i++) {
        // First user of first batch gets admin credentials
        const isFirstUser = (batch === 0 && i === 1);
        const email = isFirstUser ? 'admin@admin.com' : `player${i}@wc2026.test`;
        const password = isFirstUser ? '123456' : 'Test123456!';
        const displayName = isFirstUser ? 'Admin Player' : `Player ${i}`;
        const username = isFirstUser ? 'adminplayer' : `player${i}`;
        
        try {
          const { data: authData, error: authErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
          if (authErr || !authData.user) continue;
          registered++;
          await supabase.from('users').insert({ id: authData.user.id, username, display_name: displayName, email });
          await supabase.from('tournament_entries').insert({ tournament_id: t.id, user_id: authData.user.id, status: 'active', total_points: 0, wins: 0 });
          entered++;
          
          if (isFirstUser) {
            testUserCredentials = { email, password };
          }
        } catch (e) { /* skip */ }
      }
      
      const message = testUserCredentials 
        ? `Batch ${batch + 1} done. ${registered} users created. Test user: ${testUserCredentials.email} / ${testUserCredentials.password}`
        : `Batch ${batch + 1} done. ${registered} users created.`;
        
      return res.status(200).json({ success: true, registered, entered, batch: batch + 1, message, testUser: testUserCredentials });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SIMULATE PICKS (step-by-step) ─────────────────────────
  if (action === 'simulate_picks') {
    const { matchday } = req.body;
    if (!matchday || matchday < 1 || matchday > 3) return res.status(400).json({ error: 'Valid matchday (1-3) required' });
    try {
      const { data: t } = await supabase.from('tournaments').select('id').single();
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', 1).single();
      const { data: entries } = await supabase.from('tournament_entries').select('user_id').eq('status', 'active');
      const { data: matches } = await supabase.from('matches').select('home_team_id, away_team_id').eq('matchday', matchday);
      const availableTeams = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
      const userIds = entries.map(e => e.user_id);
      const { data: allPicks } = await supabase.from('picks').select('user_id, team_id').in('user_id', userIds);
      const userPicksMap = {};
      allPicks?.forEach(p => { if (!userPicksMap[p.user_id]) userPicksMap[p.user_id] = new Set(); userPicksMap[p.user_id].add(p.team_id); });
      const picks = [];
      for (const entry of entries) {
        const used = userPicksMap[entry.user_id] || new Set();
        const available = availableTeams.filter(x => !used.has(x));
        const selected = [...available].sort(() => 0.5 - Math.random()).slice(0, 3);
        for (const teamId of selected) picks.push({ tournament_id: t.id, user_id: entry.user_id, round_id: round.id, team_id: teamId, matchday, result: 'pending', points: 0 });
      }
      let picksMade = 0;
      for (let i = 0; i < picks.length; i += 100) { const { error } = await supabase.from('picks').insert(picks.slice(i, i + 100)); if (!error) picksMade += Math.min(100, picks.length - i); }
      return res.status(200).json({ success: true, picksMade, message: `Made ${picksMade} picks for Matchday ${matchday}.` });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SIMULATE RESULTS (step-by-step) ───────────────────────
  if (action === 'simulate_results') {
    const { matchday } = req.body;
    if (!matchday) return res.status(400).json({ error: 'Matchday required' });
    try {
      const { data: matches } = await supabase.from('matches').select('*').eq('matchday', matchday).eq('status', 'upcoming');
      let matchesUpdated = 0; let pointsAwarded = 0;
      for (const match of matches) {
        const hs = Math.floor(Math.random() * 4); const as = Math.floor(Math.random() * 4);
        const result = hs > as ? 'H' : as > hs ? 'A' : 'D';
        const winId = result === 'H' ? match.home_team_id : result === 'A' ? match.away_team_id : null;
        const loseIds = result === 'D' ? [match.home_team_id, match.away_team_id] : [result === 'H' ? match.away_team_id : match.home_team_id];
        await supabase.from('matches').update({ home_score: hs, away_score: as, result, status: 'finished' }).eq('id', match.id);
        if (winId) {
          await supabase.from('picks').update({ result: 'win', points: POINTS_STRUCTURE[1] }).eq('team_id', winId).eq('matchday', matchday).eq('result', 'pending');
          // Update entry points and wins
          const { data: winningPicks } = await supabase.from('picks').select('user_id').eq('team_id', winId).eq('matchday', matchday).eq('result', 'win');
          for (const pick of winningPicks || []) {
            await supabase.rpc('increment_points', { user_id: pick.user_id, points: POINTS_STRUCTURE[1] });
            pointsAwarded += POINTS_STRUCTURE[1];
          }
        }
        for (const lid of loseIds) await supabase.from('picks').update({ result: 'loss', points: 0 }).eq('team_id', lid).eq('matchday', matchday).eq('result', 'pending');
        matchesUpdated++;
      }
      return res.status(200).json({ success: true, matchesUpdated, pointsAwarded, message: `Updated ${matchesUpdated} matches. ${pointsAwarded} points awarded.` });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── CREATE KO MATCHES (step-by-step) ──────────────────────
  if (action === 'create_knockout_matches') {
    try {
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', 2).single();
      const { data: existing } = await supabase.from('matches').select('id').eq('round_id', round.id);
      if (existing?.length > 0) return res.status(400).json({ error: 'Round of 32 already has matches.' });
      const qualified = await get32QualifiedTeams();
      if (qualified.length < 2) return res.status(400).json({ error: 'Not enough qualified teams.' });
      const koMatches = [];
      for (let i = 0; i < qualified.length - 1; i += 2) koMatches.push({ round_id: round.id, home_team_id: qualified[i].id, away_team_id: qualified[i + 1].id, match_time: new Date(Date.now() + i * 3600000).toISOString(), status: 'upcoming' });
      const { error } = await supabase.from('matches').insert(koMatches);
      if (error) throw error;
      return res.status(200).json({ success: true, teamsQualified: qualified.length, matchesCreated: koMatches.length, message: `${qualified.length} teams qualified. Created ${koMatches.length} Round of 32 matches.` });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── CREATE NEXT ROUND MATCHES (step-by-step) ──────────────
  if (action === 'create_next_round_matches') {
    const { from_round_number } = req.body;
    if (!from_round_number || from_round_number < 2 || from_round_number > 5) return res.status(400).json({ error: 'from_round_number must be 2-5' });
    const next = from_round_number + 1;
    const roundNames = { 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
    try {
      const { data: fromRound } = await supabase.from('rounds').select('id').eq('round_number', from_round_number).single();
      const { data: nextRound } = await supabase.from('rounds').select('id').eq('round_number', next).single();
      if (!fromRound || !nextRound) return res.status(400).json({ error: `Could not find rounds` });
      const { data: existingMatches } = await supabase.from('matches').select('id').eq('round_id', nextRound.id);
      if (existingMatches?.length > 0) return res.status(400).json({ error: `${roundNames[next]} already has matches.` });
      const { data: finished } = await supabase.from('matches').select('home_team_id, away_team_id, result').eq('round_id', fromRound.id).eq('status', 'finished');
      if (!finished?.length) return res.status(400).json({ error: 'No finished matches. Run results first.' });
      const winners = finished.map(m => m.result === 'H' ? m.home_team_id : m.result === 'A' ? m.away_team_id : m.home_team_id);
      const newMatches = [];
      for (let i = 0; i < winners.length - 1; i += 2) newMatches.push({ round_id: nextRound.id, home_team_id: winners[i], away_team_id: winners[i + 1], match_time: new Date(Date.now() + i * 3600000).toISOString(), status: 'upcoming' });
      const { error } = await supabase.from('matches').insert(newMatches);
      if (error) throw error;
      return res.status(200).json({ success: true, matchesCreated: newMatches.length, nextRound: roundNames[next], message: `Created ${newMatches.length} ${roundNames[next]} matches.` });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SIMULATE KO PICKS (step-by-step) ──────────────────────
  if (action === 'simulate_knockout_picks') {
    const { round_number } = req.body;
    if (!round_number || round_number < 2 || round_number > 6) return res.status(400).json({ error: 'Valid round (2-6) required' });
    try {
      const { data: t } = await supabase.from('tournaments').select('id').single();
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', round_number).single();
      const { data: entries } = await supabase.from('tournament_entries').select('user_id').eq('status', 'active');
      const { data: matches } = await supabase.from('matches').select('home_team_id, away_team_id').eq('round_id', round.id);
      const available = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
      const userIds = entries.map(e => e.user_id);
      const { data: allPicks } = await supabase.from('picks').select('user_id, team_id').in('user_id', userIds);
      const userPicksMap = {};
      allPicks?.forEach(p => { if (!userPicksMap[p.user_id]) userPicksMap[p.user_id] = new Set(); userPicksMap[p.user_id].add(p.team_id); });
      const picks = [];
      for (const entry of entries) {
        const used = userPicksMap[entry.user_id] || new Set();
        const avail = available.filter(x => !used.has(x));
        if (avail.length > 0) picks.push({ tournament_id: t.id, user_id: entry.user_id, round_id: round.id, team_id: avail[Math.floor(Math.random() * avail.length)], matchday: null, result: 'pending', points: 0 });
      }
      let picksMade = 0;
      for (let i = 0; i < picks.length; i += 100) { const { error } = await supabase.from('picks').insert(picks.slice(i, i + 100)); if (!error) picksMade += Math.min(100, picks.length - i); }
      return res.status(200).json({ success: true, picksMade, message: `Made ${picksMade} picks for Round ${round_number}.` });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SIMULATE KO RESULTS (step-by-step) ────────────────────
  if (action === 'simulate_knockout_results') {
    const { round_number } = req.body;
    if (!round_number || round_number < 2 || round_number > 6) return res.status(400).json({ error: 'Valid round (2-6) required' });
    try {
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', round_number).single();
      const { data: matches } = await supabase.from('matches').select('*').eq('round_id', round.id).eq('status', 'upcoming');
      let matchesUpdated = 0; let pointsAwarded = 0;
      const pointsForRound = POINTS_STRUCTURE[round_number] || 2;
      for (const match of matches) {
        let hs = Math.floor(Math.random() * 4); let as = Math.floor(Math.random() * 4);
        if (hs === as) { hs > 0 ? as-- : hs++; }
        const result = hs > as ? 'H' : 'A';
        const winId = result === 'H' ? match.home_team_id : match.away_team_id;
        const loseId = result === 'H' ? match.away_team_id : match.home_team_id;
        await supabase.from('matches').update({ home_score: hs, away_score: as, result, status: 'finished' }).eq('id', match.id);
        await supabase.from('picks').update({ result: 'win', points: pointsForRound }).eq('team_id', winId).eq('round_id', round.id).eq('result', 'pending');
        await supabase.from('picks').update({ result: 'loss', points: 0 }).eq('team_id', loseId).eq('round_id', round.id).eq('result', 'pending');
        // Update entry points and wins
        const { data: winningPicks } = await supabase.from('picks').select('user_id').eq('team_id', winId).eq('round_id', round.id).eq('result', 'win');
        for (const pick of winningPicks || []) {
          await supabase.rpc('increment_points', { user_id: pick.user_id, points: pointsForRound });
          pointsAwarded += pointsForRound;
        }
        matchesUpdated++;
      }
      let winner = null;
      if (round_number === 6) {
        const { data: topEntries } = await supabase.from('tournament_entries').select('*, users:user_id(display_name)').order('total_points', { ascending: false }).limit(1);
        winner = topEntries?.[0]?.users?.display_name || 'No winner';
      }
      return res.status(200).json({ success: true, matchesUpdated, pointsAwarded, winner, message: `Updated ${matchesUpdated} matches. ${pointsAwarded} points awarded.` });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SIM_RUN — THE MAIN SIMULATION BUTTON ──────────────────
  if (action === 'sim_run') {
    try {
      const { data: tournament } = await supabase.from('tournaments').select('id').single();
      if (!tournament) return res.status(400).json({ error: 'No tournament found. Run Setup first.' });

      const { data: allUsers } = await supabase.from('users').select('id, display_name');
      if (!allUsers?.length) return res.status(400).json({ error: 'No users found. Register users first.' });

      const totalUsers = allUsers.length;

      // Clear game data, keep users + tournament + group stage matches structure
      await supabase.from('picks').delete().neq('id', FAKE_ID);
      await supabase.from('tournament_entries').delete().neq('id', FAKE_ID);

      // Delete KO round matches only
      const { data: koRounds } = await supabase.from('rounds').select('id').gte('round_number', 2);
      for (const r of koRounds || []) await supabase.from('matches').delete().eq('round_id', r.id);

      // Reset group stage matches to upcoming
      await supabase.from('matches').update({ status: 'upcoming', home_score: null, away_score: null, result: null }).in('matchday', [1, 2, 3]);

      // Re-enter all users with 0 points
      await supabase.from('tournament_entries').insert(
        allUsers.map(u => ({ tournament_id: tournament.id, user_id: u.id, status: 'active', total_points: 0, wins: 0 }))
      );

      // Get next sim number
      const { count: simCount } = await supabase.from('simulations').select('*', { count: 'exact', head: true });
      const simNumber = (simCount || 0) + 1;

      const summary = { simNumber, totalUsers, survivorsPerStage: [], winner: null, finalTop5: [], teamsQualifiedForR32: 32 };

      // getTop5 is expensive - only call at the end for final summary
      const getTop5 = async () => {
        const { data: entries } = await supabase.from('tournament_entries').select('*, users:user_id(display_name)').order('total_points', { ascending: false }).order('wins', { ascending: false }).order('entered_at', { ascending: true }).limit(5);
        return entries?.map(e => ({ name: e.users?.display_name, points: e.total_points, wins: e.wins })) || [];
      };

      const doGroupPicks = async (matchday) => {
        const { data: round } = await supabase.from('rounds').select('id').eq('round_number', 1).single();
        const { data: entries } = await supabase.from('tournament_entries').select('user_id').eq('status', 'active');
        const { data: matches } = await supabase.from('matches').select('home_team_id, away_team_id').eq('matchday', matchday);
        const availTeams = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
        const userIds = entries.map(e => e.user_id);
        const { data: allPicks } = await supabase.from('picks').select('user_id, team_id').in('user_id', userIds);
        const upm = {};
        allPicks?.forEach(p => { if (!upm[p.user_id]) upm[p.user_id] = new Set(); upm[p.user_id].add(p.team_id); });
        const picks = [];
        for (const entry of entries) {
          const used = upm[entry.user_id] || new Set();
          const avail = availTeams.filter(t => !used.has(t));
          const selected = [...avail].sort(() => 0.5 - Math.random()).slice(0, 3);
          for (const teamId of selected) picks.push({ tournament_id: tournament.id, user_id: entry.user_id, round_id: round.id, team_id: teamId, matchday, result: 'pending', points: 0 });
        }
        for (let i = 0; i < picks.length; i += 100) await supabase.from('picks').insert(picks.slice(i, i + 100));
      };

      const doGroupResults = async (matchday) => {
        const { data: matches } = await supabase.from('matches').select('*').eq('matchday', matchday).eq('status', 'upcoming');
        let pointsAwarded = 0;
        const userPoints = {}; // Aggregate points per user for batch update

        for (const match of matches) {
          const hs = Math.floor(Math.random() * 4); const as = Math.floor(Math.random() * 4);
          const result = hs > as ? 'H' : as > hs ? 'A' : 'D';
          const winId = result === 'H' ? match.home_team_id : result === 'A' ? match.away_team_id : null;
          const loseIds = result === 'D' ? [match.home_team_id, match.away_team_id] : [result === 'H' ? match.away_team_id : match.home_team_id];
          await supabase.from('matches').update({ home_score: hs, away_score: as, result, status: 'finished' }).eq('id', match.id);
          if (winId) {
            await supabase.from('picks').update({ result: 'win', points: POINTS_STRUCTURE[1] }).eq('team_id', winId).eq('matchday', matchday).eq('result', 'pending');
            const { data: winningPicks } = await supabase.from('picks').select('user_id').eq('team_id', winId).eq('matchday', matchday).eq('result', 'win');
            // Aggregate points per user instead of individual RPC calls
            for (const pick of winningPicks || []) {
              userPoints[pick.user_id] = (userPoints[pick.user_id] || 0) + POINTS_STRUCTURE[1];
              pointsAwarded += POINTS_STRUCTURE[1];
            }
          }
          for (const lid of loseIds) await supabase.from('picks').update({ result: 'loss', points: 0 }).eq('team_id', lid).eq('matchday', matchday).eq('result', 'pending');
        }

        // Batch update all users at once
        for (const [userId, points] of Object.entries(userPoints)) {
          await supabase.rpc('increment_points', { user_id: userId, points });
        }

        return { pointsAwarded };
      };

      const doKORound = async (roundNum) => {
        const { data: round } = await supabase.from('rounds').select('id').eq('round_number', roundNum).single();
        const { data: entries } = await supabase.from('tournament_entries').select('user_id').eq('status', 'active');
        const { data: matches } = await supabase.from('matches').select('home_team_id, away_team_id').eq('round_id', round.id);
        const userIds = entries.map(e => e.user_id);
        const { data: allPicks } = await supabase.from('picks').select('user_id, team_id').in('user_id', userIds);
        const upm = {};
        allPicks?.forEach(p => { if (!upm[p.user_id]) upm[p.user_id] = new Set(); upm[p.user_id].add(p.team_id); });
        const avail = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
        const picks = [];
        for (const entry of entries) {
          const used = upm[entry.user_id] || new Set();
          const a = avail.filter(t => !used.has(t));
          if (a.length > 0) picks.push({ tournament_id: tournament.id, user_id: entry.user_id, round_id: round.id, team_id: a[Math.floor(Math.random() * a.length)], matchday: null, result: 'pending', points: 0 });
        }
        for (let i = 0; i < picks.length; i += 100) await supabase.from('picks').insert(picks.slice(i, i + 100));

        const { data: koMatches } = await supabase.from('matches').select('*').eq('round_id', round.id).eq('status', 'upcoming');
        let pointsAwarded = 0;
        const pointsForRound = POINTS_STRUCTURE[roundNum] || 2;
        const userPoints = {}; // Aggregate points per user for batch update

        for (const match of koMatches) {
          let hs = Math.floor(Math.random() * 4); let as = Math.floor(Math.random() * 4);
          if (hs === as) { hs > 0 ? as-- : hs++; }
          const result = hs > as ? 'H' : 'A';
          const winId = result === 'H' ? match.home_team_id : match.away_team_id;
          const loseId = result === 'H' ? match.away_team_id : match.home_team_id;
          await supabase.from('matches').update({ home_score: hs, away_score: as, result, status: 'finished' }).eq('id', match.id);
          await supabase.from('picks').update({ result: 'win', points: pointsForRound }).eq('team_id', winId).eq('round_id', round.id).eq('result', 'pending');
          await supabase.from('picks').update({ result: 'loss', points: 0 }).eq('team_id', loseId).eq('round_id', round.id).eq('result', 'pending');
          const { data: winningPicks } = await supabase.from('picks').select('user_id').eq('team_id', winId).eq('round_id', round.id).eq('result', 'win');
          // Aggregate points per user instead of individual RPC calls
          for (const pick of winningPicks || []) {
            userPoints[pick.user_id] = (userPoints[pick.user_id] || 0) + pointsForRound;
            pointsAwarded += pointsForRound;
          }
        }

        // Batch update all users at once
        for (const [userId, points] of Object.entries(userPoints)) {
          await supabase.rpc('increment_points', { user_id: userId, points });
        }

        return { pointsAwarded };
      };

      const advanceKO = async (fromRoundNum) => {
        const { data: fromRound } = await supabase.from('rounds').select('id').eq('round_number', fromRoundNum).single();
        const { data: nextRound } = await supabase.from('rounds').select('id').eq('round_number', fromRoundNum + 1).single();
        const { data: finished } = await supabase.from('matches').select('home_team_id, away_team_id, result').eq('round_id', fromRound.id).eq('status', 'finished');
        const winners = finished.map(m => m.result === 'H' ? m.home_team_id : m.away_team_id);
        const newMatches = [];
        for (let i = 0; i < winners.length - 1; i += 2) newMatches.push({ round_id: nextRound.id, home_team_id: winners[i], away_team_id: winners[i + 1], match_time: new Date(Date.now() + i * 3600000).toISOString(), status: 'upcoming' });
        if (newMatches.length > 0) await supabase.from('matches').insert(newMatches);
      };

      // GROUP STAGE
      await doGroupPicks(1);
      const md1Result = await doGroupResults(1);
      summary.survivorsPerStage.push({ stage: 'Matchday 1', pointsAwarded: md1Result.pointsAwarded });

      await doGroupPicks(2);
      const md2Result = await doGroupResults(2);
      summary.survivorsPerStage.push({ stage: 'Matchday 2', pointsAwarded: md2Result.pointsAwarded });

      await doGroupPicks(3);
      const md3Result = await doGroupResults(3);
      summary.survivorsPerStage.push({ stage: 'Matchday 3', pointsAwarded: md3Result.pointsAwarded });

      // R32
      const qualified = await get32QualifiedTeams();
      summary.teamsQualifiedForR32 = qualified.length;
      const { data: r32round } = await supabase.from('rounds').select('id').eq('round_number', 2).single();
      const r32matches = [];
      for (let i = 0; i < qualified.length - 1; i += 2) r32matches.push({ round_id: r32round.id, home_team_id: qualified[i].id, away_team_id: qualified[i + 1].id, match_time: new Date(Date.now() + i * 3600000).toISOString(), status: 'upcoming' });
      await supabase.from('matches').insert(r32matches);

      // KO ROUNDS
      const roundNames = { 2: 'Round of 32', 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
      for (let r = 2; r <= 6; r++) {
        const result = await doKORound(r);
        summary.survivorsPerStage.push({ stage: roundNames[r], pointsAwarded: result.pointsAwarded });
        if (r < 6) await advanceKO(r);
      }

      // WINNER
      const finalTop5 = await getTop5();
      summary.finalTop5 = finalTop5;
      summary.winner = finalTop5[0]?.name || 'No winner';

      // SAVE TO DB
      await supabase.from('simulations').insert({ sim_number: simNumber, total_users: totalUsers, winner: summary.winner, final_top5: finalTop5, summary });

      return res.status(200).json({ success: true, summary, message: `Sim #${simNumber} complete. Winner: ${summary.winner}` });

    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── GET SIMULATIONS ────────────────────────────────────────
  if (action === 'get_simulations') {
    try {
      const { data: sims, error } = await supabase.from('simulations').select('*').order('sim_number', { ascending: true });
      if (error) throw error;
      return res.status(200).json({ success: true, simulations: sims || [], count: sims?.length || 0 });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── CLEAR SIMULATIONS ──────────────────────────────────────
  if (action === 'clear_simulations') {
    try {
      await supabase.from('simulations').delete().neq('id', FAKE_ID);
      return res.status(200).json({ success: true, message: 'All simulation history cleared.' });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── DEBUG: Inspect API structure ──────────────────────────
  if (action === 'debug_api') {
    try {
      const response = await fetch(FOOTBALL_DATA_URL, {
        headers: { 'X-Auth-Token': FOOTBALL_DATA_TOKEN }
      });
      
      if (!response.ok) {
        return res.status(500).json({ error: `API error: ${response.status}` });
      }
      
      const data = await response.json();
      const fixtures = data.matches || [];
      const stages = [...new Set(fixtures.map(f => f.stage))];
      const koMatch = fixtures.find(f => f.stage !== 'GROUP_STAGE');
      
      return res.status(200).json({
        totalMatches: fixtures.length,
        stages: stages,
        sampleKnockoutMatch: koMatch
      });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── CHECK API FOR KNOCKOUT MATCHES ─────────────────────────
  if (action === 'check_ko_matches') {
    const { round_number } = req.body || {};
    if (!round_number || round_number < 2 || round_number > 6) {
      return res.status(400).json({ error: 'Valid round_number (2-6) required' });
    }
    
    try {
      const apiResponse = await fetch(FOOTBALL_DATA_URL, {
        headers: { 'X-Auth-Token': FOOTBALL_DATA_TOKEN }
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        return res.status(500).json({ 
          error: `football-data.org API error: ${apiResponse.status}`,
          details: errorText
        });
      }

      const apiData = await apiResponse.json();
      const fixtures = apiData.matches || [];

      const stageMap = { 2: 'LAST_32', 3: 'LAST_16', 4: 'QUARTER_FINALS', 5: 'SEMI_FINALS', 6: 'FINAL' };
      const targetStage = stageMap[round_number];
      
      // Debug: get all unique stages in API
      const allStages = [...new Set(fixtures.map(f => f.stage))];
      
      const koMatches = fixtures.filter(f => f.stage === targetStage || (round_number === 6 && f.stage === 'FINAL'));

      if (koMatches.length === 0) {
        return res.status(200).json({
          found: false,
          message: `No ${targetStage} matches found in API yet.`,
          round: round_number,
          stage: targetStage,
          availableStages: allStages
        });
      }

      const { data: teams } = await supabase.from('teams').select('id, name');
      const teamLookup = new Map();
      teams?.forEach(t => {
        teamLookup.set(t.name, t.id);
        teamLookup.set(t.name.toLowerCase(), t.id);
      });

      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', round_number).single();
      if (!round) return res.status(400).json({ error: `Round ${round_number} not found` });

      const { data: existingMatches } = await supabase.from('matches').select('id').eq('round_id', round.id);
      if (existingMatches?.length > 0) {
        return res.status(200).json({
          found: true,
          alreadyLoaded: true,
          message: `${existingMatches.length} matches already loaded for this round.`,
          matches: existingMatches.length
        });
      }

      // Check if teams are null (draw not done yet)
      const sampleMatch = koMatches[0];
      if (!sampleMatch.homeTeam?.name || !sampleMatch.awayTeam?.name) {
        return res.status(200).json({
          found: true,
          drawPending: true,
          message: `${koMatches.length} ${targetStage} matches found in API, but teams are TBD (draw not completed).`,
          matchesInApi: koMatches.length,
          stage: targetStage,
          note: 'FIFA will populate team data after the draw. Check again later.'
        });
      }

      const matches = [];
      const missingTeams = [];
      for (const match of koMatches) {
        const homeName = TEAM_MAPPINGS[match.homeTeam?.name] || match.homeTeam?.name;
        const awayName = TEAM_MAPPINGS[match.awayTeam?.name] || match.awayTeam?.name;
        
        const homeTeamId = teamLookup.get(homeName) || teamLookup.get(homeName?.toLowerCase());
        const awayTeamId = teamLookup.get(awayName) || teamLookup.get(awayName?.toLowerCase());
        
        if (!homeTeamId) { missingTeams.push(match.homeTeam?.name); continue; }
        if (!awayTeamId) { missingTeams.push(match.awayTeam?.name); continue; }
        
        matches.push({
          round_id: round.id,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          match_time: match.utcDate,
          status: 'upcoming'
        });
      }

      if (matches.length === 0) {
        return res.status(200).json({
          found: true,
          loadable: false,
          message: 'Matches found in API but teams not matched to database.',
          missingTeams: [...new Set(missingTeams)],
          apiMatchesFound: koMatches.length
        });
      }

      const { data: inserted, error: insertError } = await supabase.from('matches').insert(matches).select();
      if (insertError) return res.status(500).json({ error: 'Failed to insert matches', details: insertError.message });

      return res.status(200).json({
        found: true,
        loaded: true,
        message: `Loaded ${inserted.length} matches for Round ${round_number}`,
        matches: inserted.length,
        missingTeams: missingTeams.length > 0 ? [...new Set(missingTeams)] : null
      });

    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ═══════════════════════════════════════════════════════════
  // STEP-BY-STEP SIMULATION ACTIONS (avoid Vercel 10s timeout)
  // ═══════════════════════════════════════════════════════════

  // ── SIM_INIT: Clear game data, reset users with lives ──────
  if (action === 'sim_init') {
    const { sim_lives = 5 } = req.body;
    try {
      const { data: tournament } = await supabase.from('tournaments').select('id').single();
      if (!tournament) return res.status(400).json({ error: 'No tournament found' });
      const { data: allUsers } = await supabase.from('users').select('id, display_name');
      if (!allUsers?.length) return res.status(400).json({ error: 'No users found' });

      // Clear game data
      await supabase.from('picks').delete().neq('id', FAKE_ID);
      await supabase.from('tournament_entries').delete().neq('id', FAKE_ID);
      const { data: koRounds } = await supabase.from('rounds').select('id').gte('round_number', 2);
      for (const r of koRounds || []) await supabase.from('matches').delete().eq('round_id', r.id);
      await supabase.from('matches').update({ status: 'upcoming', home_score: null, away_score: null, result: null }).in('matchday', [1, 2, 3]);

      // Re-enter users
      await supabase.from('tournament_entries').insert(allUsers.map(u => ({ tournament_id: tournament.id, user_id: u.id, status: 'active', lives_remaining: sim_lives, max_lives: sim_lives })));

      // Get sim number
      const { count: simCount } = await supabase.from('simulations').select('*', { count: 'exact', head: true });
      const simNumber = (simCount || 0) + 1;

      return res.status(200).json({ success: true, simNumber, totalUsers: allUsers.length, simLives: sim_lives });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SIM_GROUP_PICKS: Make picks for a matchday ─────────────
  if (action === 'sim_group_picks') {
    const { matchday } = req.body;
    if (!matchday) return res.status(400).json({ error: 'matchday required' });
    try {
      const { data: tournament } = await supabase.from('tournaments').select('id').single();
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', 1).single();
      const { data: entries } = await supabase.from('tournament_entries').select('user_id').eq('status', 'active').gt('lives_remaining', 0);
      const { data: matches } = await supabase.from('matches').select('home_team_id, away_team_id').eq('matchday', matchday);
      const availTeams = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
      const userIds = entries.map(e => e.user_id);
      const { data: allPicks } = await supabase.from('picks').select('user_id, team_id').in('user_id', userIds);
      const upm = {};
      allPicks?.forEach(p => { if (!upm[p.user_id]) upm[p.user_id] = new Set(); upm[p.user_id].add(p.team_id); });
      const picks = [];
      for (const entry of entries) {
        const used = upm[entry.user_id] || new Set();
        const avail = availTeams.filter(t => !used.has(t));
        const selected = [...avail].sort(() => 0.5 - Math.random()).slice(0, 3);
        for (const teamId of selected) picks.push({ tournament_id: tournament.id, user_id: entry.user_id, round_id: round.id, team_id: teamId, matchday, result: 'pending' });
      }
      for (let i = 0; i < picks.length; i += 100) await supabase.from('picks').insert(picks.slice(i, i + 100));
      return res.status(200).json({ success: true, picksMade: picks.length });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SIM_GROUP_RESULTS: Process results for a matchday ──────
  if (action === 'sim_group_results') {
    const { matchday } = req.body;
    if (!matchday) return res.status(400).json({ error: 'matchday required' });
    try {
      const { data: matches } = await supabase.from('matches').select('*').eq('matchday', matchday).eq('status', 'upcoming');
      let eliminations = 0;
      for (const match of matches) {
        const hs = Math.floor(Math.random() * 4); const as = Math.floor(Math.random() * 4);
        const result = hs > as ? 'H' : as > hs ? 'A' : 'D';
        const winId = result === 'H' ? match.home_team_id : result === 'A' ? match.away_team_id : null;
        const loseIds = result === 'D' ? [match.home_team_id, match.away_team_id] : [result === 'H' ? match.away_team_id : match.home_team_id];
        await supabase.from('matches').update({ home_score: hs, away_score: as, result, status: 'finished' }).eq('id', match.id);
        if (winId) await supabase.from('picks').update({ result: 'win' }).eq('team_id', winId).eq('matchday', matchday).eq('result', 'pending');
        for (const lid of loseIds) await supabase.from('picks').update({ result: 'loss' }).eq('team_id', lid).eq('matchday', matchday).eq('result', 'pending');
      }
      const { data: lp } = await supabase.from('picks').select('user_id').eq('matchday', matchday).eq('result', 'loss');
      const ul = {};
      lp?.forEach(p => { ul[p.user_id] = (ul[p.user_id] || 0) + 1; });
      const lids = Object.keys(ul);
      if (lids.length > 0) {
        const { data: allEntries } = await supabase.from('tournament_entries').select('user_id, lives_remaining, tournament_id').in('user_id', lids).gt('lives_remaining', 0);
        await Promise.all((allEntries || []).map(async entry => {
          const newLives = Math.max(0, entry.lives_remaining - (ul[entry.user_id] || 0));
          if (newLives === 0) eliminations++;
          await supabase.from('tournament_entries').update({ lives_remaining: newLives, ...(newLives === 0 ? { status: 'eliminated', eliminated_round: 1 } : {}) }).eq('user_id', entry.user_id).eq('tournament_id', entry.tournament_id);
        }));
      }
      const { count: survivors } = await supabase.from('tournament_entries').select('*', { count: 'exact', head: true }).eq('status', 'active').gt('lives_remaining', 0);
      return res.status(200).json({ success: true, eliminations, survivors: survivors || 0 });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SIM_CREATE_R32: Create Round of 32 matches ─────────────
  if (action === 'sim_create_r32') {
    try {
      const qualified = await get32QualifiedTeams();
      const { data: r32round } = await supabase.from('rounds').select('id').eq('round_number', 2).single();
      const r32matches = [];
      for (let i = 0; i < qualified.length - 1; i += 2) {
        r32matches.push({ round_id: r32round.id, home_team_id: qualified[i].id, away_team_id: qualified[i + 1].id, match_time: new Date(Date.now() + i * 3600000).toISOString(), status: 'upcoming' });
      }
      await supabase.from('matches').insert(r32matches);
      return res.status(200).json({ success: true, teamsQualified: qualified.length, matchesCreated: r32matches.length });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SIM_KO_ROUND: Picks + Results for a KO round ───────────
  if (action === 'sim_ko_round') {
    const { round_number } = req.body;
    if (!round_number || round_number < 2 || round_number > 6) return res.status(400).json({ error: 'round_number 2-6 required' });
    try {
      const { data: tournament } = await supabase.from('tournaments').select('id').single();
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', round_number).single();
      const { data: entries } = await supabase.from('tournament_entries').select('user_id').eq('status', 'active').gt('lives_remaining', 0);
      const { data: matches } = await supabase.from('matches').select('home_team_id, away_team_id').eq('round_id', round.id);
      const userIds = entries.map(e => e.user_id);
      const { data: allPicks } = await supabase.from('picks').select('user_id, team_id').in('user_id', userIds);
      const upm = {};
      allPicks?.forEach(p => { if (!upm[p.user_id]) upm[p.user_id] = new Set(); upm[p.user_id].add(p.team_id); });
      const avail = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
      const picks = [];
      for (const entry of entries) {
        const used = upm[entry.user_id] || new Set();
        const a = avail.filter(t => !used.has(t));
        if (a.length > 0) picks.push({ tournament_id: tournament.id, user_id: entry.user_id, round_id: round.id, team_id: a[Math.floor(Math.random() * a.length)], matchday: null, result: 'pending' });
      }
      for (let i = 0; i < picks.length; i += 100) await supabase.from('picks').insert(picks.slice(i, i + 100));

      // Results
      const { data: koMatches } = await supabase.from('matches').select('*').eq('round_id', round.id).eq('status', 'upcoming');
      let eliminations = 0;
      for (const match of koMatches) {
        let hs = Math.floor(Math.random() * 4); let as = Math.floor(Math.random() * 4);
        if (hs === as) { hs > 0 ? as-- : hs++; }
        const result = hs > as ? 'H' : 'A';
        const winId = result === 'H' ? match.home_team_id : match.away_team_id;
        const loseId = result === 'H' ? match.away_team_id : match.home_team_id;
        await supabase.from('matches').update({ home_score: hs, away_score: as, result, status: 'finished' }).eq('id', match.id);
        await supabase.from('picks').update({ result: 'win' }).eq('team_id', winId).eq('round_id', round.id).eq('result', 'pending');
        await supabase.from('picks').update({ result: 'loss' }).eq('team_id', loseId).eq('round_id', round.id).eq('result', 'pending');
      }
      const { data: lp } = await supabase.from('picks').select('user_id').eq('round_id', round.id).eq('result', 'loss');
      const losingIds = [...new Set((lp || []).map(p => p.user_id))];
      if (losingIds.length > 0) {
        const { data: allEntries } = await supabase.from('tournament_entries').select('user_id, lives_remaining, tournament_id').in('user_id', losingIds).gt('lives_remaining', 0);
        await Promise.all((allEntries || []).map(async entry => {
          const newLives = entry.lives_remaining - 1;
          if (newLives === 0) eliminations++;
          await supabase.from('tournament_entries').update({ lives_remaining: newLives, ...(newLives === 0 ? { status: 'eliminated', eliminated_round: round_number } : {}) }).eq('user_id', entry.user_id).eq('tournament_id', entry.tournament_id);
        }));
      }
      const { count: survivors } = await supabase.from('tournament_entries').select('*', { count: 'exact', head: true }).eq('status', 'active').gt('lives_remaining', 0);
      return res.status(200).json({ success: true, eliminations, survivors: survivors || 0 });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SIM_ADVANCE: Create next round matches ─────────────────
  if (action === 'sim_advance') {
    const { from_round } = req.body;
    if (!from_round || from_round < 2 || from_round > 5) return res.status(400).json({ error: 'from_round 2-5 required' });
    try {
      const { data: fromRound } = await supabase.from('rounds').select('id').eq('round_number', from_round).single();
      const { data: nextRound } = await supabase.from('rounds').select('id').eq('round_number', from_round + 1).single();
      const { data: finished } = await supabase.from('matches').select('home_team_id, away_team_id, result').eq('round_id', fromRound.id).eq('status', 'finished');
      const winners = finished.map(m => m.result === 'H' ? m.home_team_id : m.away_team_id);
      const newMatches = [];
      for (let i = 0; i < winners.length - 1; i += 2) {
        newMatches.push({ round_id: nextRound.id, home_team_id: winners[i], away_team_id: winners[i + 1], match_time: new Date(Date.now() + i * 3600000).toISOString(), status: 'upcoming' });
      }
      if (newMatches.length > 0) await supabase.from('matches').insert(newMatches);
      return res.status(200).json({ success: true, matchesCreated: newMatches.length });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  // ── SIM_FINALIZE: Save results to simulations table ────────
  if (action === 'sim_finalize') {
    const { sim_number, sim_lives, total_users } = req.body;
    try {
      const { data: winners } = await supabase.from('tournament_entries').select('users:user_id(display_name)').eq('status', 'active').order('lives_remaining', { ascending: false }).limit(5);
      const winner = winners?.[0]?.users?.display_name || 'No winner';
      const { count: finalSurvivors } = await supabase.from('tournament_entries').select('*', { count: 'exact', head: true }).eq('status', 'active').gt('lives_remaining', 0);

      const summary = {
        simNumber: sim_number,
        totalUsers: total_users,
        sim_lives: sim_lives,
        winner,
        finalSurvivors: finalSurvivors || 0,
        teamsQualifiedForR32: 32,
        survivorsPerStage: []
      };

      await supabase.from('simulations').insert({ sim_number, total_users, lives_setting: sim_lives, winner, final_survivors: finalSurvivors || 0, summary });

      return res.status(200).json({ success: true, summary });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  }

  return res.status(400).json({ error: 'Invalid action.' });
};
