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
          lives: 7,
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
  // ACTION: simulate_users
  // Creates test users in batches via Supabase Auth API
  // Each batch = 10 users, 5 batches = 50 total
  // ─────────────────────────────────────────────────────────
  if (action === 'simulate_users') {
    const { batch = 0 } = req.body;
    
    try {
      const { data: tournament } = await supabase.from('tournaments').select('id').single();
      if (!tournament) {
        return res.status(400).json({ error: 'No tournament found. Run Setup first.' });
      }

      let registered = 0;
      let entered = 0;
      const startNum = batch * 10 + 1;
      const endNum = startNum + 9;
      
      // Create 10 users per batch
      for (let i = startNum; i <= endNum; i++) {
        const email = `player${i}@wc2026.test`;
        const password = 'Test123456!';
        
        try {
          // Create auth user
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
          });
          
          if (authError) {
            console.log('Auth error for user', i, ':', authError.message);
            continue;
          }
          
          if (authData.user) {
            registered++;
            
            // Create profile
            await supabase.from('users').insert({
              id: authData.user.id,
              username: `player${i}`,
              display_name: `Player ${i}`,
              email
            });
            
            // Enter tournament
            await supabase.from('tournament_entries').insert({
              tournament_id: tournament.id,
              user_id: authData.user.id,
              status: 'active',
              lives_remaining: 7,
              max_lives: 7
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
  // Makes picks for all users for a specific matchday
  // Uses batch inserts for speed
  // ─────────────────────────────────────────────────────────
  if (action === 'simulate_picks') {
    const { matchday } = req.body;
    if (!matchday || matchday < 1 || matchday > 3) {
      return res.status(400).json({ error: 'Valid matchday (1-3) required' });
    }

    try {
      const { data: tournament } = await supabase.from('tournaments').select('id').single();
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', 1).single();
      
      // Get active users
      const { data: entries } = await supabase
        .from('tournament_entries')
        .select('user_id')
        .eq('status', 'active')
        .gt('lives_remaining', 0);
      
      // Get teams for this matchday
      const { data: matches } = await supabase
        .from('matches')
        .select('home_team_id, away_team_id')
        .eq('matchday', matchday);
      
      const availableTeams = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
      
      // Get all existing picks for these users to avoid duplicates
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
      
      // Prepare all picks in memory
      const picks = [];
      
      for (const entry of entries) {
        const usedTeams = userPicksMap[entry.user_id] || new Set();
        const available = availableTeams.filter(t => !usedTeams.has(t));
        
        // Shuffle and pick 3
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
      
      // Batch insert in chunks
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
  // Enters random results for all matches in a matchday
  // Uses batch updates for speed
  // ─────────────────────────────────────────────────────────
  if (action === 'simulate_results') {
    const { matchday } = req.body;
    if (!matchday) {
      return res.status(400).json({ error: 'Matchday required' });
    }

    try {
      // Get all matches for this matchday
      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('matchday', matchday)
        .eq('status', 'upcoming');
      
      let matchesUpdated = 0;
      let eliminations = 0;
      
      // Process all matches
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
        
        // Update match
        await supabase.from('matches').update({
          home_score: homeScore,
          away_score: awayScore,
          result,
          status: 'finished'
        }).eq('id', match.id);
        
        // Update picks in batch
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
      
      // Now handle eliminations - get all users who lost this matchday
      const { data: losingPicks } = await supabase
        .from('picks')
        .select('user_id')
        .eq('matchday', matchday)
        .eq('result', 'loss');
      
      const userLosses = {};
      losingPicks?.forEach(p => {
        userLosses[p.user_id] = (userLosses[p.user_id] || 0) + 1;
      });
      
      // Deduct lives for each loss
      for (const [userId, losses] of Object.entries(userLosses)) {
        const { data: entry } = await supabase
          .from('tournament_entries')
          .select('lives_remaining, tournament_id')
          .eq('user_id', userId)
          .single();
        
        if (entry && entry.lives_remaining > 0) {
          const newLives = Math.max(0, entry.lives_remaining - losses);
          await supabase.from('tournament_entries').update({
            lives_remaining: newLives,
            ...(newLives === 0 ? { status: 'eliminated', eliminated_round: 1 } : {})
          }).eq('user_id', userId).eq('tournament_id', entry.tournament_id);
          
          if (newLives === 0) eliminations++;
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
  // ACTION: simulate_knockout_picks
  // Makes 1 pick per surviving user for a knockout round
  // ─────────────────────────────────────────────────────────
  if (action === 'simulate_knockout_picks') {
    const { round_number } = req.body;
    if (!round_number || round_number < 2 || round_number > 6) {
      return res.status(400).json({ error: 'Valid round number (2-6) required' });
    }

    try {
      const { data: tournament } = await supabase.from('tournaments').select('id').single();
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', round_number).single();
      
      const { data: entries } = await supabase.from('tournament_entries').select('user_id').eq('status', 'active').gt('lives_remaining', 0);
      const { data: matches } = await supabase.from('matches').select('home_team_id, away_team_id').eq('round_id', round.id);
      
      const availableTeams = matches.flatMap(m => [m.home_team_id, m.away_team_id]);
      const userIds = entries.map(e => e.user_id);
      const { data: allPicks } = await supabase.from('picks').select('user_id, team_id').in('user_id', userIds);
      
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
          picks.push({ tournament_id: tournament.id, user_id: entry.user_id, round_id: round.id, team_id: teamId, matchday: null, result: 'pending' });
        }
      }
      
      const chunkSize = 50;
      let picksMade = 0;
      for (let i = 0; i < picks.length; i += chunkSize) {
        const { error } = await supabase.from('picks').insert(picks.slice(i, i + chunkSize));
        if (!error) picksMade += Math.min(chunkSize, picks.length - i);
      }

      return res.status(200).json({ success: true, picksMade, message: `Made ${picksMade} picks for Round ${round_number}.` });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACTION: simulate_knockout_results
  // Enters results for a knockout round
  // ─────────────────────────────────────────────────────────
  if (action === 'simulate_knockout_results') {
    const { round_number } = req.body;
    if (!round_number || round_number < 2 || round_number > 6) {
      return res.status(400).json({ error: 'Valid round number (2-6) required' });
    }

    try {
      const { data: round } = await supabase.from('rounds').select('id').eq('round_number', round_number).single();
      const { data: matches } = await supabase.from('matches').select('*').eq('round_id', round.id).eq('status', 'upcoming');
      
      let matchesUpdated = 0;
      let eliminations = 0;
      
      for (const match of matches) {
        let homeScore = Math.floor(Math.random() * 4);
        let awayScore = Math.floor(Math.random() * 4);
        if (homeScore === awayScore) { if (Math.random() > 0.5) homeScore++; else awayScore++; }
        
        const result = homeScore > awayScore ? 'H' : 'A';
        const winningTeamId = result === 'H' ? match.home_team_id : match.away_team_id;
        const losingTeamId = result === 'H' ? match.away_team_id : match.home_team_id;
        
        await supabase.from('matches').update({ home_score: homeScore, away_score: awayScore, result, status: 'finished' }).eq('id', match.id);
        await supabase.from('picks').update({ result: 'win' }).eq('team_id', winningTeamId).eq('round_id', round.id).eq('result', 'pending');
        await supabase.from('picks').update({ result: 'loss' }).eq('team_id', losingTeamId).eq('round_id', round.id).eq('result', 'pending');
        matchesUpdated++;
      }
      
      const { data: losingPicks } = await supabase.from('picks').select('user_id').eq('round_id', round.id).eq('result', 'loss');
      for (const pick of losingPicks || []) {
        const { data: entry } = await supabase.from('tournament_entries').select('lives_remaining, tournament_id').eq('user_id', pick.user_id).single();
        if (entry && entry.lives_remaining > 0) {
          const newLives = entry.lives_remaining - 1;
          await supabase.from('tournament_entries').update({ lives_remaining: newLives, ...(newLives === 0 ? { status: 'eliminated', eliminated_round: round_number } : {}) }).eq('user_id', pick.user_id).eq('tournament_id', entry.tournament_id);
          if (newLives === 0) eliminations++;
        }
      }
      
      let winner = null;
      if (round_number === 6) {
        const { data: survivors } = await supabase.from('tournament_entries').select('users:user_id(display_name)').eq('status', 'active').limit(1);
        if (survivors && survivors.length > 0) winner = survivors[0].users?.display_name || 'Unknown';
      }

      return res.status(200).json({ success: true, matchesUpdated, eliminations, winner, message: `Updated ${matchesUpdated} matches. ${eliminations} users eliminated.` });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action.' });
};
