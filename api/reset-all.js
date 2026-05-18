// Vercel Function: Reset All Data + Setup Tournament + Simulation
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
  'United States': 'USA'
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
  // SHARED HELPER: Calculate group standings
  // Returns standings for all teams sorted within their group
  // Also returns third-place teams sorted by points for 
  // determining the 8 best third-placed qualifiers
  // ─────────────────────────────────────────────────────────
  async function calculateGroupStandings() {
    const { data: teams } = await supabase.from('teams').select('id, name, group_name');
    const { data: matches } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id, home_score, away_score, result')
      .eq('status', 'finished')
      .in('matchday', [1, 2, 3]);

    // Build standings map
    const standings = {};
    teams.forEach(t => {
      standings[t.id] = {
        id: t.id,
        name: t.name,
        group_name: t.group_name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,  // goals for
        ga: 0,  // goals against
        points: 0
      };
    });

    matches.forEach(m => {
      const home = standings[m.home_team_id];
      const away = standings[m.away_team_id];
      if (!home || !away) return;

      home.played++;
      away.played++;
      home.gf += m.home_score || 0;
      home.ga += m.away_score || 0;
      away.gf += m.away_score || 0;
      away.ga += m.home_score || 0;

      if (m.result === 'H') {
        home.won++; home.points += 3;
        away.lost++;
      } else if (m.result === 'A') {
        away.won++; away.points += 3;
        home.lost++;
      } else if (m.result === 'D') {
        home.drawn++; home.points += 1;
        away.drawn++; away.points += 1;
      }
    });

    // Group teams by group_name and sort within each group
    const groups = {};
    Object.values(standings).forEach(t => {
      if (!groups[t.group_name]) groups[t.group_name] = [];
      groups[t.group_name].push(t);
    });

    // Sort each group: points desc, goal difference desc, goals for desc
    const sortFn = (a, b) =>
      b.points - a.points ||
      (b.gf - b.ga) - (a.gf - a.ga) ||
      b.gf - a.gf;

    Object.values(groups).forEach(g => g.sort(sortFn));

    return { groups, standings };
  }

  // ─────────────────────────────────────────────────────────
  // SHARED HELPER: Get 32 qualified teams
  // 2026 World Cup: 12 groups of 4
  //   - Top 2 from each group = 24 teams
  //   - Best 8 third-placed teams = 8 more teams
  //   - Total = 32 teams for Round of 32
  // ─────────────────────────────────────────────────────────
  async function get32QualifiedTeams() {
    const { groups } = await calculateGroupStandings();

    const top2 = [];        // 24 teams: top 2 from each of 12 groups
    const thirdPlace = [];  // 12 teams: one per group, sorted later

    Object.entries(groups).forEach(([groupName, groupTeams]) => {
      if (groupTeams.length >= 1) top2.push(groupTeams[0]);
      if (groupTeams.length >= 2) top2.push(groupTeams[1]);
      if (groupTeams.length >= 3) thirdPlace.push(groupTeams[2]);
    });

    // Sort third-placed teams by points, then GD, then GF
    const sortFn = (a, b) =>
      b.points - a.points ||
      (b.gf - b.ga) - (a.gf - a.ga) ||
      b.gf - a.gf;

    thirdPlace.sort(sortFn);

    // Take best 8 third-placed teams
    const best8Third = thirdPlace.slice(0, 8);

    // All 32 qualified teams
    const qualified = [...top2, ...best8Third];

    return qualified;
  }

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
      await supabase.from('picks').delete().neq('id', FAKE_ID);
      await supabase.from('tournament_entries').delete().neq('id', FAKE_ID);
      await supabase.from('matches').delete().neq('id', FAKE_ID);
      await supabase.from('rounds').delete().neq('id', FAKE_ID);
      await supabase.from('tournaments').delete().neq('id', FAKE_ID);
      await supabase.from('teams').delete().neq('id', FAKE_ID);
      await supabase.from('users').delete().neq('id', FAKE_ID);

      await supabase.from('master_clock').upsert({
        id: 'current',
        current_round: 1,
        current_matchday: 1,
        status: 'upcoming'
      });

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
  // imports group stage matches — all in one go
  // ─────────────────────────────────────────────────────────
  if (action === 'setup') {
    try {
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

      const { data: masterTeams, error: masterError } = await supabase.from('master_teams').select('*');

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

      const fixtureResponse = await fetch(FIXTURE_URL);
      const fixtures = await fixtureResponse.json();

      const { data: insertedTeams } = await supabase.from('teams').select('id, name');
      const teamLookup = new Map(insertedTeams.map(t => [t.name, t.id]));

      const { data: insertedRounds } = await supabase.from('rounds').select('id, round_number');
      const roundLookup = new Map(insertedRounds.map(r => [r.round_number, r.id]));

      const groupStageFixtures = fixtures.filter(f => f.RoundNumber >= 1 && f.RoundNumber <= 3);

      const matches = [];
      const missingTeams = [];

      for (const match of groupStageFixtures) {
        let homeName = TEAM_MAPPINGS[match.HomeTeam] || match.HomeTeam;
        let awayName = TEAM_MAPPINGS[match.AwayTeam] || match.AwayTeam;

        let homeTeamId = teamLookup.get(homeName);
        let awayTeamId = teamLookup.get(awayName);

        if (!homeTeamId) {
          const rev = Object.entries(TEAM_MAPPINGS).find(([k, v]) => v === homeName)?.[0];
          if (rev) homeTeamId = teamLookup.get(rev);
        }
        if (!awayTeamId) {
          const rev = Object.entries(TEAM_MAPPINGS).find(([k, v]) => v === awayName)?.[0];
          if (rev) awayTeamId = teamLookup.get(rev);
        }

        if (!homeTeamId) { missingTeams.push(`${match.HomeTeam}`); continue; }
        if (!awayTeamId) { missingTeams.push(`${match.AwayTeam}`); continue; }

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
        message: `Tournament ready. ${masterTeams.length} teams, 6 rounds, ${matches.length} group stage matches imported. Group Stage is open.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: set_lives
  // Updates tournament lives setting and all active entries
  // ─────────────────────────────────────────────────────────
  if (action === 'set_lives') {
    const { lives } = req.body;
    if (!lives || lives < 1 || lives > 10) {
      return res.status(400).json({ error: 'Lives must be between 1 and 10' });
    }

    try {
      const { data: tournament } = await supabase.from('tournaments').select('id').single();
      if (!tournament) return res.status(400).json({ error: 'No tournament found' });

      await supabase.from('tournaments').update({ lives }).eq('id', tournament.id);

      const { data: updated, error: updateError } = await supabase
        .from('tournament_entries')
        .update({ lives_remaining: lives, max_lives: lives })
        .eq('tournament_id', tournament.id)
        .eq('status', 'active')
        .select();

      if (updateError) throw updateError;

      return res.status(200).json({
        success: true,
        lives,
        entriesUpdated: updated?.length || 0,
        message: `Lives set to ${lives}. Updated ${updated?.length || 0} active entries.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: simulate_users
  // Creates test users in batches of 10
  // ─────────────────────────────────────────────────────────
  if (action === 'simulate_users') {
    const { batch = 0 } = req.body;

    try {
      const { data: tournament } = await supabase.from('tournaments').select('id, lives').single();
      if (!tournament) {
        return res.status(400).json({ error: 'No tournament found. Run Setup first.' });
      }

      const startLives = tournament.lives || 3;
      let registered = 0;
      let entered = 0;
      const startNum = batch * 10 + 1;
      const endNum = startNum + 9;

      for (let i = startNum; i <= endNum; i++) {
        const email = `player${i}@wc2026.test`;
        const password = 'Test123456!';

        try {
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
          });

          if (authError) continue;

          if (authData.user) {
            registered++;
            await supabase.from('users').insert({
              id: authData.user.id,
              username: `player${i}`,
              display_name: `Player ${i}`,
              email
            });

            await supabase.from('tournament_entries').insert({
              tournament_id: tournament.id,
              user_id: authData.user.id,
              status: 'active',
              lives_remaining: startLives,
              max_lives: startLives
            });

            entered++;
          }
        } catch (e) {
          console.log('Error for user', i, ':', e.message);
        }
      }

      return res.status(200).json({
        success: true,
        registered,
        entered,
        batch: batch + 1,
        message: `Batch ${batch + 1} complete. Created ${registered} users, entered ${entered} into tournament.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: simulate_picks
  // Makes 3 picks per active user for a group stage matchday
  // ─────────────────────────────────────────────────────────
  if (action === 'simulate_picks') {
    const { matchday } = req.body;
    if (!matchday || matchday < 1 || matchday > 3) {
      return res.status(400).json({ error: 'Valid matchday (1-3) required' });
    }

    try {
      const { data: tournament } = await supabase.from('tournaments').select('id').single();
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', 1).single();

      const { data: entries } = await supabase
        .from('tournament_entries')
        .select('user_id')
        .eq('status', 'active')
        .gt('lives_remaining', 0);

      const { data: matches } = await supabase
        .from('matches')
        .select('home_team_id, away_team_id')
        .eq('matchday', matchday);

      const availableTeams = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
      const userIds = entries.map(e => e.user_id);

      const { data: allPicks } = await supabase
        .from('picks')
        .select('user_id, team_id')
        .in('user_id', userIds);

      const userPicksMap = {};
      allPicks?.forEach(p => {
        if (!userPicksMap[p.user_id]) userPicksMap[p.user_id] = new Set();
        userPicksMap[p.user_id].add(p.team_id);
      });

      const picks = [];
      for (const entry of entries) {
        const usedTeams = userPicksMap[entry.user_id] || new Set();
        const available = availableTeams.filter(t => !usedTeams.has(t));
        const shuffled = [...available].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);

        for (const teamId of selected) {
          picks.push({
            tournament_id: tournament.id,
            user_id: entry.user_id,
            round_id: round.id,
            team_id: teamId,
            matchday,
            result: 'pending'
          });
        }
      }

      const chunkSize = 50;
      let picksMade = 0;
      for (let i = 0; i < picks.length; i += chunkSize) {
        const { error } = await supabase.from('picks').insert(picks.slice(i, i + chunkSize));
        if (!error) picksMade += Math.min(chunkSize, picks.length - i);
      }

      return res.status(200).json({
        success: true,
        picksMade,
        message: `Made ${picksMade} picks for Matchday ${matchday}.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: simulate_results
  // Simulates random results for all matches in a matchday
  // Deducts a life per losing pick, handles eliminations
  // ─────────────────────────────────────────────────────────
  if (action === 'simulate_results') {
    const { matchday } = req.body;
    if (!matchday) {
      return res.status(400).json({ error: 'Matchday required' });
    }

    try {
      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('matchday', matchday)
        .eq('status', 'upcoming');

      let matchesUpdated = 0;
      let eliminations = 0;

      for (const match of matches) {
        const homeScore = Math.floor(Math.random() * 4);
        const awayScore = Math.floor(Math.random() * 4);

        let result;
        if (homeScore > awayScore) result = 'H';
        else if (awayScore > homeScore) result = 'A';
        else result = 'D';

        const winningTeamId = result === 'H' ? match.home_team_id :
                             result === 'A' ? match.away_team_id : null;
        const losingTeamIds = result === 'D'
          ? [match.home_team_id, match.away_team_id]
          : [result === 'H' ? match.away_team_id : match.home_team_id];

        await supabase.from('matches').update({
          home_score: homeScore,
          away_score: awayScore,
          result,
          status: 'finished'
        }).eq('id', match.id);

        if (winningTeamId) {
          await supabase.from('picks').update({ result: 'win' })
            .eq('team_id', winningTeamId).eq('matchday', matchday).eq('result', 'pending');
        }

        for (const losingTeamId of losingTeamIds) {
          await supabase.from('picks').update({ result: 'loss' })
            .eq('team_id', losingTeamId).eq('matchday', matchday).eq('result', 'pending');
        }

        matchesUpdated++;
      }

      // Deduct lives — one life per losing pick
      const { data: losingPicks } = await supabase
        .from('picks')
        .select('user_id')
        .eq('matchday', matchday)
        .eq('result', 'loss');

      const userLosses = {};
      losingPicks?.forEach(p => {
        userLosses[p.user_id] = (userLosses[p.user_id] || 0) + 1;
      });

      for (const [userId, losses] of Object.entries(userLosses)) {
        const { data: entry } = await supabase
          .from('tournament_entries')
          .select('lives_remaining, tournament_id')
          .eq('user_id', userId)
          .single();

        if (entry && entry.lives_remaining > 0) {
          const newLives = Math.max(0, entry.lives_remaining - losses);
          if (newLives === 0) eliminations++;

          await supabase.from('tournament_entries').update({
            lives_remaining: newLives,
            ...(newLives === 0 ? { status: 'eliminated', eliminated_round: 1 } : {})
          }).eq('user_id', userId).eq('tournament_id', entry.tournament_id);
        }
      }

      return res.status(200).json({
        success: true,
        matchesUpdated,
        eliminations,
        message: `Updated ${matchesUpdated} matches. ${eliminations} users eliminated.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: create_knockout_matches
  // Creates Round of 32 from group stage results
  // 2026 World Cup: top 2 from 12 groups (24) + best 8 third-placed = 32 teams
  // ─────────────────────────────────────────────────────────
  if (action === 'create_knockout_matches') {
    try {
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', 2).single();

      // Check R32 doesn't already have matches
      const { data: existing } = await supabase.from('matches').select('id').eq('round_id', round.id);
      if (existing && existing.length > 0) {
        return res.status(400).json({ error: 'Round of 32 already has matches. Clear them first.' });
      }

      const qualified = await get32QualifiedTeams();

      if (qualified.length < 2) {
        return res.status(400).json({ error: `Only ${qualified.length} teams qualified. Need at least 2. Make sure all group stage matches are finished.` });
      }

      // Create matches pairing consecutive qualified teams
      const knockoutMatches = [];
      for (let i = 0; i < qualified.length - 1; i += 2) {
        knockoutMatches.push({
          round_id: round.id,
          home_team_id: qualified[i].id,
          away_team_id: qualified[i + 1].id,
          match_time: new Date(Date.now() + i * 3600000).toISOString(),
          status: 'upcoming'
        });
      }

      const { error } = await supabase.from('matches').insert(knockoutMatches);
      if (error) throw error;

      return res.status(200).json({
        success: true,
        teamsQualified: qualified.length,
        matchesCreated: knockoutMatches.length,
        message: `${qualified.length} teams qualified (24 top-2 + ${qualified.length - 24} best third-placed). Created ${knockoutMatches.length} Round of 32 matches.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: create_next_round_matches
  // Takes winners from a finished KO round and creates the next round
  // from_round_number 2 → creates R16 (round 3)
  // from_round_number 3 → creates QF (round 4)
  // from_round_number 4 → creates SF (round 5)
  // from_round_number 5 → creates Final (round 6)
  // ─────────────────────────────────────────────────────────
  if (action === 'create_next_round_matches') {
    const { from_round_number } = req.body;

    if (!from_round_number || from_round_number < 2 || from_round_number > 5) {
      return res.status(400).json({ error: 'from_round_number must be 2-5' });
    }

    const next_round_number = from_round_number + 1;
    const roundNames = { 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };

    try {
      const { data: fromRound } = await supabase.from('rounds').select('id').eq('round_number', from_round_number).single();
      const { data: nextRound } = await supabase.from('rounds').select('id').eq('round_number', next_round_number).single();

      if (!fromRound || !nextRound) {
        return res.status(400).json({ error: `Could not find rounds ${from_round_number} or ${next_round_number}` });
      }

      // Check next round doesn't already have matches
      const { data: existingMatches } = await supabase.from('matches').select('id').eq('round_id', nextRound.id);
      if (existingMatches && existingMatches.length > 0) {
        return res.status(400).json({ error: `${roundNames[next_round_number]} already has matches.` });
      }

      // Get finished matches from the completed round
      const { data: finishedMatches } = await supabase
        .from('matches')
        .select('home_team_id, away_team_id, result')
        .eq('round_id', fromRound.id)
        .eq('status', 'finished');

      if (!finishedMatches || finishedMatches.length === 0) {
        return res.status(400).json({ error: `No finished matches found for round ${from_round_number}. Run results first.` });
      }

      // Check all matches in the round are finished
      const { data: allRoundMatches } = await supabase
        .from('matches')
        .select('id, status')
        .eq('round_id', fromRound.id);

      const unfinished = allRoundMatches?.filter(m => m.status !== 'finished').length || 0;
      if (unfinished > 0) {
        return res.status(400).json({ error: `${unfinished} matches in round ${from_round_number} are not finished yet.` });
      }

      // Extract winners — no draws in KO, force a winner if draw (home wins by default)
      const winningTeams = finishedMatches.map(m => {
        if (m.result === 'H') return m.home_team_id;
        if (m.result === 'A') return m.away_team_id;
        return m.home_team_id; // fallback for draws (shouldn't happen in KO)
      });

      // Pair winners into new matches
      const newMatches = [];
      for (let i = 0; i < winningTeams.length - 1; i += 2) {
        newMatches.push({
          round_id: nextRound.id,
          home_team_id: winningTeams[i],
          away_team_id: winningTeams[i + 1],
          match_time: new Date(Date.now() + i * 3600000).toISOString(),
          status: 'upcoming'
        });
      }

      const { error: insertError } = await supabase.from('matches').insert(newMatches);
      if (insertError) throw insertError;

      return res.status(200).json({
        success: true,
        matchesCreated: newMatches.length,
        nextRound: roundNames[next_round_number],
        message: `Created ${newMatches.length} ${roundNames[next_round_number]} matches from ${winningTeams.length} winners.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: simulate_knockout_picks
  // Makes 1 pick per surviving user for a KO round
  // ─────────────────────────────────────────────────────────
  if (action === 'simulate_knockout_picks') {
    const { round_number } = req.body;
    if (!round_number || round_number < 2 || round_number > 6) {
      return res.status(400).json({ error: 'Valid round number (2-6) required' });
    }

    try {
      const { data: tournament } = await supabase.from('tournaments').select('id').single();
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', round_number).single();

      const { data: entries } = await supabase
        .from('tournament_entries')
        .select('user_id')
        .eq('status', 'active')
        .gt('lives_remaining', 0);

      const { data: matches } = await supabase
        .from('matches')
        .select('home_team_id, away_team_id')
        .eq('round_id', round.id);

      const availableTeams = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
      const userIds = entries.map(e => e.user_id);

      const { data: allPicks } = await supabase
        .from('picks')
        .select('user_id, team_id')
        .in('user_id', userIds);

      const userPicksMap = {};
      allPicks?.forEach(p => {
        if (!userPicksMap[p.user_id]) userPicksMap[p.user_id] = new Set();
        userPicksMap[p.user_id].add(p.team_id);
      });

      const picks = [];
      for (const entry of entries) {
        const usedTeams = userPicksMap[entry.user_id] || new Set();
        const available = availableTeams.filter(t => !usedTeams.has(t));
        if (available.length > 0) {
          const teamId = available[Math.floor(Math.random() * available.length)];
          picks.push({
            tournament_id: tournament.id,
            user_id: entry.user_id,
            round_id: round.id,
            team_id: teamId,
            matchday: null,
            result: 'pending'
          });
        }
      }

      const chunkSize = 50;
      let picksMade = 0;
      for (let i = 0; i < picks.length; i += chunkSize) {
        const { error } = await supabase.from('picks').insert(picks.slice(i, i + chunkSize));
        if (!error) picksMade += Math.min(chunkSize, picks.length - i);
      }

      return res.status(200).json({
        success: true,
        picksMade,
        message: `Made ${picksMade} picks for Round ${round_number}.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: simulate_knockout_results
  // Simulates results for a KO round — no draws allowed
  // Deducts 1 life per losing pick
  // ─────────────────────────────────────────────────────────
  if (action === 'simulate_knockout_results') {
    const { round_number } = req.body;
    if (!round_number || round_number < 2 || round_number > 6) {
      return res.status(400).json({ error: 'Valid round number (2-6) required' });
    }

    try {
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', round_number).single();
      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('round_id', round.id)
        .eq('status', 'upcoming');

      let matchesUpdated = 0;
      let eliminations = 0;

      for (const match of matches) {
        // Force a winner — no draws in knockout
        let homeScore = Math.floor(Math.random() * 4);
        let awayScore = Math.floor(Math.random() * 4);
        if (homeScore === awayScore) {
          if (Math.random() > 0.5) homeScore++;
          else awayScore++;
        }

        const result = homeScore > awayScore ? 'H' : 'A';
        const winningTeamId = result === 'H' ? match.home_team_id : match.away_team_id;
        const losingTeamId = result === 'H' ? match.away_team_id : match.home_team_id;

        await supabase.from('matches').update({
          home_score: homeScore,
          away_score: awayScore,
          result,
          status: 'finished'
        }).eq('id', match.id);

        await supabase.from('picks').update({ result: 'win' })
          .eq('team_id', winningTeamId).eq('round_id', round.id).eq('result', 'pending');
        await supabase.from('picks').update({ result: 'loss' })
          .eq('team_id', losingTeamId).eq('round_id', round.id).eq('result', 'pending');

        matchesUpdated++;
      }

      // Deduct lives for each loss
      const { data: losingPicks } = await supabase
        .from('picks')
        .select('user_id')
        .eq('round_id', round.id)
        .eq('result', 'loss');

      for (const pick of losingPicks || []) {
        const { data: entry } = await supabase
          .from('tournament_entries')
          .select('lives_remaining, tournament_id')
          .eq('user_id', pick.user_id)
          .single();

        if (entry && entry.lives_remaining > 0) {
          const newLives = entry.lives_remaining - 1;
          if (newLives === 0) eliminations++;

          await supabase.from('tournament_entries').update({
            lives_remaining: newLives,
            ...(newLives === 0 ? { status: 'eliminated', eliminated_round: round_number } : {})
          }).eq('user_id', pick.user_id).eq('tournament_id', entry.tournament_id);
        }
      }

      // Find winner if this was the Final
      let winner = null;
      if (round_number === 6) {
        const { data: survivors } = await supabase
          .from('tournament_entries')
          .select('users:user_id(display_name)')
          .eq('status', 'active')
          .limit(3);
        winner = survivors?.[0]?.users?.display_name || 'No winner (all eliminated)';
      }

      return res.status(200).json({
        success: true,
        matchesUpdated,
        eliminations,
        winner,
        message: `Updated ${matchesUpdated} matches. ${eliminations} users eliminated.`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: simulate_full
  // Runs the ENTIRE tournament in one call:
  // - Registers users
  // - Group stage: picks + results for MD1, MD2, MD3
  // - Creates R32 from correct 32-team qualification
  // - KO rounds 2-6: picks + results + advance
  // - Returns full elimination summary
  // ─────────────────────────────────────────────────────────
  if (action === 'simulate_full') {
    const { user_count = 50 } = req.body;

    try {
      const { data: tournament } = await supabase.from('tournaments').select('id, lives').single();
      if (!tournament) return res.status(400).json({ error: 'No tournament found. Run Setup first.' });

      const startLives = tournament.lives || 3;
      const summary = {
        usersRegistered: 0,
        startLives,
        survivorsPerStage: [],
        winner: null,
        finalSurvivors: 0
      };

      // ── Register users ──
      for (let i = 1; i <= user_count; i++) {
        const email = `simuser${i}@wc2026.test`;
        try {
          const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email, password: 'Test123456!', email_confirm: true
          });
          if (authErr || !authData.user) continue;

          await supabase.from('users').insert({
            id: authData.user.id,
            username: `simuser${i}`,
            display_name: `Sim Player ${i}`,
            email
          });

          await supabase.from('tournament_entries').insert({
            tournament_id: tournament.id,
            user_id: authData.user.id,
            status: 'active',
            lives_remaining: startLives,
            max_lives: startLives
          });

          summary.usersRegistered++;
        } catch (e) { /* skip failed user */ }
      }

      // Helper: count active survivors
      const countSurvivors = async () => {
        const { count } = await supabase
          .from('tournament_entries')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')
          .gt('lives_remaining', 0);
        return count || 0;
      };

      // Helper: make group stage picks for a matchday
      const doGroupPicks = async (matchday) => {
        const { data: round } = await supabase.from('rounds').select('id').eq('round_number', 1).single();
        const { data: entries } = await supabase.from('tournament_entries').select('user_id').eq('status', 'active').gt('lives_remaining', 0);
        const { data: matches } = await supabase.from('matches').select('home_team_id, away_team_id').eq('matchday', matchday);
        const availableTeams = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
        const userIds = entries.map(e => e.user_id);
        const { data: allPicks } = await supabase.from('picks').select('user_id, team_id').in('user_id', userIds);
        const userPicksMap = {};
        allPicks?.forEach(p => { if (!userPicksMap[p.user_id]) userPicksMap[p.user_id] = new Set(); userPicksMap[p.user_id].add(p.team_id); });
        const picks = [];
        for (const entry of entries) {
          const used = userPicksMap[entry.user_id] || new Set();
          const available = availableTeams.filter(t => !used.has(t));
          const selected = [...available].sort(() => 0.5 - Math.random()).slice(0, 3);
          for (const teamId of selected) {
            picks.push({ tournament_id: tournament.id, user_id: entry.user_id, round_id: round.id, team_id: teamId, matchday, result: 'pending' });
          }
        }
        for (let i = 0; i < picks.length; i += 50) await supabase.from('picks').insert(picks.slice(i, i + 50));
      };

      // Helper: simulate results for a group stage matchday
      const doGroupResults = async (matchday) => {
        const { data: matches } = await supabase.from('matches').select('*').eq('matchday', matchday).eq('status', 'upcoming');
        let eliminations = 0;

        for (const match of matches) {
          const hs = Math.floor(Math.random() * 4);
          const as = Math.floor(Math.random() * 4);
          const result = hs > as ? 'H' : as > hs ? 'A' : 'D';
          const winId = result === 'H' ? match.home_team_id : result === 'A' ? match.away_team_id : null;
          const loseIds = result === 'D' ? [match.home_team_id, match.away_team_id] : [result === 'H' ? match.away_team_id : match.home_team_id];

          await supabase.from('matches').update({ home_score: hs, away_score: as, result, status: 'finished' }).eq('id', match.id);
          if (winId) await supabase.from('picks').update({ result: 'win' }).eq('team_id', winId).eq('matchday', matchday).eq('result', 'pending');
          for (const lid of loseIds) await supabase.from('picks').update({ result: 'loss' }).eq('team_id', lid).eq('matchday', matchday).eq('result', 'pending');
        }

        const { data: losingPicks } = await supabase.from('picks').select('user_id').eq('matchday', matchday).eq('result', 'loss');
        const userLosses = {};
        losingPicks?.forEach(p => { userLosses[p.user_id] = (userLosses[p.user_id] || 0) + 1; });

        for (const [uid, losses] of Object.entries(userLosses)) {
          const { data: entry } = await supabase.from('tournament_entries').select('lives_remaining, tournament_id').eq('user_id', uid).single();
          if (entry && entry.lives_remaining > 0) {
            const newLives = Math.max(0, entry.lives_remaining - losses);
            if (newLives === 0) eliminations++;
            await supabase.from('tournament_entries').update({ lives_remaining: newLives, ...(newLives === 0 ? { status: 'eliminated', eliminated_round: 1 } : {}) }).eq('user_id', uid).eq('tournament_id', entry.tournament_id);
          }
        }

        return { matches: matches.length, eliminations };
      };

      // Helper: simulate a full KO round (picks + results + life deduction)
      const doKORound = async (roundNum) => {
        const { data: round } = await supabase.from('rounds').select('id').eq('round_number', roundNum).single();
        const { data: entries } = await supabase.from('tournament_entries').select('user_id').eq('status', 'active').gt('lives_remaining', 0);
        const { data: matches } = await supabase.from('matches').select('home_team_id, away_team_id').eq('round_id', round.id);
        const userIds = entries.map(e => e.user_id);
        const { data: allPicks } = await supabase.from('picks').select('user_id, team_id').in('user_id', userIds);
        const userPicksMap = {};
        allPicks?.forEach(p => { if (!userPicksMap[p.user_id]) userPicksMap[p.user_id] = new Set(); userPicksMap[p.user_id].add(p.team_id); });
        const availableTeams = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
        const picks = [];
        for (const entry of entries) {
          const used = userPicksMap[entry.user_id] || new Set();
          const available = availableTeams.filter(t => !used.has(t));
          if (available.length > 0) {
            picks.push({ tournament_id: tournament.id, user_id: entry.user_id, round_id: round.id, team_id: available[Math.floor(Math.random() * available.length)], matchday: null, result: 'pending' });
          }
        }
        for (let i = 0; i < picks.length; i += 50) await supabase.from('picks').insert(picks.slice(i, i + 50));

        // Simulate results (no draws)
        const { data: koMatches } = await supabase.from('matches').select('*').eq('round_id', round.id).eq('status', 'upcoming');
        let eliminations = 0;
        for (const match of koMatches) {
          let hs = Math.floor(Math.random() * 4), as = Math.floor(Math.random() * 4);
          if (hs === as) hs > 0 ? as-- : hs++;
          const result = hs > as ? 'H' : 'A';
          const winId = result === 'H' ? match.home_team_id : match.away_team_id;
          const loseId = result === 'H' ? match.away_team_id : match.home_team_id;
          await supabase.from('matches').update({ home_score: hs, away_score: as, result, status: 'finished' }).eq('id', match.id);
          await supabase.from('picks').update({ result: 'win' }).eq('team_id', winId).eq('round_id', round.id).eq('result', 'pending');
          await supabase.from('picks').update({ result: 'loss' }).eq('team_id', loseId).eq('round_id', round.id).eq('result', 'pending');
        }

        const { data: losingPicks } = await supabase.from('picks').select('user_id').eq('round_id', round.id).eq('result', 'loss');
        for (const pick of losingPicks || []) {
          const { data: entry } = await supabase.from('tournament_entries').select('lives_remaining, tournament_id').eq('user_id', pick.user_id).single();
          if (entry && entry.lives_remaining > 0) {
            const newLives = entry.lives_remaining - 1;
            if (newLives === 0) eliminations++;
            await supabase.from('tournament_entries').update({ lives_remaining: newLives, ...(newLives === 0 ? { status: 'eliminated', eliminated_round: roundNum } : {}) }).eq('user_id', pick.user_id).eq('tournament_id', entry.tournament_id);
          }
        }

        return { survivors: await countSurvivors(), eliminations };
      };

      // Helper: create next round matches from winners
      const advanceKO = async (fromRoundNum) => {
        const { data: fromRound } = await supabase.from('rounds').select('id').eq('round_number', fromRoundNum).single();
        const { data: nextRound } = await supabase.from('rounds').select('id').eq('round_number', fromRoundNum + 1).single();
        const { data: finished } = await supabase.from('matches').select('home_team_id, away_team_id, result').eq('round_id', fromRound.id).eq('status', 'finished');
        const winners = finished.map(m => m.result === 'H' ? m.home_team_id : m.away_team_id);
        const newMatches = [];
        for (let i = 0; i < winners.length - 1; i += 2) {
          newMatches.push({ round_id: nextRound.id, home_team_id: winners[i], away_team_id: winners[i + 1], match_time: new Date(Date.now() + i * 3600000).toISOString(), status: 'upcoming' });
        }
        if (newMatches.length > 0) await supabase.from('matches').insert(newMatches);
        return newMatches.length;
      };

      // ── GROUP STAGE ──
      await doGroupPicks(1);
      const md1 = await doGroupResults(1);
      summary.survivorsPerStage.push({ stage: 'After Matchday 1', survivors: await countSurvivors(), eliminated: md1.eliminations });

      await doGroupPicks(2);
      const md2 = await doGroupResults(2);
      summary.survivorsPerStage.push({ stage: 'After Matchday 2', survivors: await countSurvivors(), eliminated: md2.eliminations });

      await doGroupPicks(3);
      const md3 = await doGroupResults(3);
      const afterGroupStage = await countSurvivors();
      summary.survivorsPerStage.push({ stage: 'After Matchday 3 (Group Stage complete)', survivors: afterGroupStage, eliminated: md3.eliminations });

      // ── CREATE R32 from correct 32-team qualification ──
      const qualified = await get32QualifiedTeams();
      const { data: r32round } = await supabase.from('rounds').select('id').eq('round_number', 2).single();
      const r32matches = [];
      for (let i = 0; i < qualified.length - 1; i += 2) {
        r32matches.push({
          round_id: r32round.id,
          home_team_id: qualified[i].id,
          away_team_id: qualified[i + 1].id,
          match_time: new Date(Date.now() + i * 3600000).toISOString(),
          status: 'upcoming'
        });
      }
      await supabase.from('matches').insert(r32matches);

      // ── KNOCKOUT ROUNDS ──
      const roundNames = { 2: 'Round of 32', 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
      for (let r = 2; r <= 6; r++) {
        const result = await doKORound(r);
        summary.survivorsPerStage.push({ stage: roundNames[r], survivors: result.survivors, eliminated: result.eliminations });
        if (r < 6 && result.survivors > 1) {
          await advanceKO(r);
        }
      }

      // ── WINNER ──
      const { data: winners } = await supabase
        .from('tournament_entries')
        .select('users:user_id(display_name)')
        .eq('status', 'active')
        .limit(5);

      summary.winner = winners?.[0]?.users?.display_name || 'No winner (all eliminated)';
      summary.finalSurvivors = winners?.length || 0;
      summary.teamsQualifiedForR32 = qualified.length;

      return res.status(200).json({
        success: true,
        summary,
        message: `Full simulation complete. Winner: ${summary.winner}`
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action.' });
};
