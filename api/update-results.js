// Vercel Function: Auto-update results from football-data.org
// Points-based system - awards points for wins instead of deducting lives
const { createClient } = require('@supabase/supabase-js');

const FOOTBALL_DATA_URL = 'https://api.football-data.org/v4/competitions/WC/matches?season=2026';
const FOOTBALL_DATA_TOKEN = 'aef925b3b2df4c6e922f08a5498bdab0';

// Name mappings: football-data.org names → our teams table names
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

function normaliseTeamName(name) {
  return TEAM_MAPPINGS[name] || name;
}

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

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET
  );

  // ── Check polling is enabled in DB before calling football-data.org ──
  const { data: clock } = await supabase
    .from('master_clock')
    .select('polling_enabled')
    .eq('id', 'current')
    .single();

  if (!clock || clock.polling_enabled !== true) {
    return res.status(200).json({ 
      success: true, 
      message: 'Polling is disabled — no results fetched.',
      matchesUpdated: 0,
      picksProcessed: 0,
      pointsAwarded: 0
    });
  }

  try {
    // ── Fetch from football-data.org ──────────────────────
    const apiResponse = await fetch(FOOTBALL_DATA_URL, {
      headers: {
        'X-Auth-Token': FOOTBALL_DATA_TOKEN
      }
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return res.status(500).json({
        error: `football-data.org API error: ${apiResponse.status} — ${errorText}`
      });
    }

    const apiData = await apiResponse.json();
    const fixtures = apiData.matches || [];

    // Only process matches that are FINISHED
    const finishedFixtures = fixtures.filter(f =>
      f.status === 'FINISHED' &&
      f.score?.fullTime?.home !== null &&
      f.score?.fullTime?.away !== null
    );

    if (finishedFixtures.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No finished matches found yet.',
        matchesUpdated: 0,
        picksProcessed: 0,
        pointsAwarded: 0
      });
    }

    // ── Load teams from DB ────────────────────────────────
    const { data: teams } = await supabase.from('teams').select('id, name');
    const teamMap = new Map();
    teams?.forEach(t => {
      teamMap.set(t.name, t.id);
      teamMap.set(t.name.toLowerCase(), t.id);
    });

    // Helper to look up team by name with normalisation
    const findTeamId = (name) => {
      const normalised = normaliseTeamName(name);
      return teamMap.get(normalised) ||
             teamMap.get(name) ||
             teamMap.get(normalised.toLowerCase()) ||
             null;
    };

    // ── Load all unfinished DB matches ────────────────────
    const { data: dbMatches } = await supabase
      .from('matches')
      .select('id, home_team_id, away_team_id, status, round_id, matchday, rounds:round_id(round_number)')
      .eq('status', 'upcoming');

    let matchesUpdated = 0;
    let picksProcessed = 0;
    let pointsAwarded = 0;
    const skipped = [];

    // ── AUTO-PICK: Assign random picks to users who missed deadline ──
    // This runs before processing results to ensure all users have picks
    for (const fixture of finishedFixtures) {
      const homeName = fixture.homeTeam?.name || fixture.homeTeam?.shortName;
      const awayName = fixture.awayTeam?.name || fixture.awayTeam?.shortName;
      const homeTeamId = findTeamId(homeName);
      const awayTeamId = findTeamId(awayName);
      
      if (!homeTeamId || !awayTeamId) continue;
      
      const dbMatch = dbMatches?.find(m =>
        m.home_team_id === homeTeamId && m.away_team_id === awayTeamId
      );
      
      if (!dbMatch) continue;
      
      const roundNumber = dbMatch.rounds?.round_number || 1;
      const matchday = dbMatch.matchday;
      
      // Find all active users who don't have a pick for this match/round
      const { data: activeEntries } = await supabase
        .from('tournament_entries')
        .select('user_id')
        .eq('status', 'active');
      
      for (const entry of activeEntries || []) {
        // Check if user already has a pick for this round/matchday
        let existingPickQuery = supabase
          .from('picks')
          .select('id')
          .eq('user_id', entry.user_id)
          .eq('round_id', dbMatch.round_id);
        
        if (roundNumber === 1 && matchday) {
          existingPickQuery = existingPickQuery.eq('matchday', matchday);
        }
        
        const { data: existingPicks } = await existingPickQuery;
        
        if (!existingPicks || existingPicks.length === 0) {
          // User missed this pick - auto-assign a random team
          const { data: userAllPicks } = await supabase
            .from('picks')
            .select('team_id')
            .eq('user_id', entry.user_id);
          
          const usedTeamIds = userAllPicks?.map(p => p.team_id) || [];
          
          // Get available teams for this matchday/round
          let availableTeams = [homeTeamId, awayTeamId];
          
          // For group stage, get all teams playing in this matchday
          if (roundNumber === 1 && matchday) {
            const { data: mdMatches } = await supabase
              .from('matches')
              .select('home_team_id, away_team_id')
              .eq('round_id', dbMatch.round_id)
              .eq('matchday', matchday);
            availableTeams = mdMatches?.flatMap(m => [m.home_team_id, m.away_team_id]) || [];
          }
          
          // Filter out already used teams
          const unusedTeams = availableTeams.filter(tid => !usedTeamIds.includes(tid));
          
          if (unusedTeams.length > 0) {
            const randomTeam = unusedTeams[Math.floor(Math.random() * unusedTeams.length)];
            
            const autoPickData = {
              user_id: entry.user_id,
              tournament_id: (await supabase.from('tournaments').select('id').single()).data?.id,
              round_id: dbMatch.round_id,
              team_id: randomTeam,
              matchday: matchday || null,
              result: 'pending',
              points: 0,
              is_auto_pick: true
            };
            
            // Add score prediction for QF, SF, Final
            if (roundNumber >= 4) {
              autoPickData.predicted_home_score = Math.floor(Math.random() * 4);
              autoPickData.predicted_away_score = Math.floor(Math.random() * 3);
            }
            
            await supabase.from('picks').insert(autoPickData);
          }
        }
      }
    }

    // ── Process each finished fixture ─────────────────────
    for (const fixture of finishedFixtures) {
      const homeScore = fixture.score.fullTime.home;
      const awayScore = fixture.score.fullTime.away;

      const homeName = fixture.homeTeam?.name || fixture.homeTeam?.shortName;
      const awayName = fixture.awayTeam?.name || fixture.awayTeam?.shortName;

      const homeTeamId = findTeamId(homeName);
      const awayTeamId = findTeamId(awayName);

      if (!homeTeamId || !awayTeamId) {
        skipped.push(`${homeName} vs ${awayName} — team not found in DB`);
        continue;
      }

      // Find matching DB match (home + away team combo)
      const dbMatch = dbMatches?.find(m =>
        m.home_team_id === homeTeamId && m.away_team_id === awayTeamId
      );

      if (!dbMatch) {
        skipped.push(`${homeName} vs ${awayName} — no upcoming match in DB`);
        continue;
      }

      // Determine result
      let result;
      if (homeScore > awayScore) result = 'H';
      else if (awayScore > homeScore) result = 'A';
      else result = 'D';

      // Get round number for points calculation
      const roundNumber = dbMatch.rounds?.round_number || 1;
      const pointsForWin = POINTS_STRUCTURE[roundNumber] || 2;

      // ── Update match record ───────────────────────────
      const { error: matchUpdateError } = await supabase
        .from('matches')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          result,
          status: 'finished'
        })
        .eq('id', dbMatch.id);

      if (matchUpdateError) {
        skipped.push(`${homeName} vs ${awayName} — DB update failed: ${matchUpdateError.message}`);
        continue;
      }

      matchesUpdated++;

      // ── Update picks: win / loss ──────────────────────
      const winningTeamId = result === 'H' ? homeTeamId :
                            result === 'A' ? awayTeamId : null;

      const losingTeamIds = result === 'D'
        ? [homeTeamId, awayTeamId]
        : [result === 'H' ? awayTeamId : homeTeamId];

      // Get matchday for filtering (Group Stage has multiple matchdays)
      const matchday = dbMatch.matchday;

      // Mark winning picks and award points
      if (winningTeamId) {
        let winUpdateQuery = supabase
          .from('picks')
          .update({ result: 'win', points: pointsForWin })
          .eq('team_id', winningTeamId)
          .eq('round_id', dbMatch.round_id)
          .eq('result', 'pending');
        
        // Add matchday filter for Group Stage (round 1)
        if (roundNumber === 1 && matchday) {
          winUpdateQuery = winUpdateQuery.eq('matchday', matchday);
        }
        
        await winUpdateQuery;

        // Update tournament entries with points and wins
        let winningPicksQuery = supabase
          .from('picks')
          .select('id, user_id, predicted_home_score, predicted_away_score')
          .eq('team_id', winningTeamId)
          .eq('round_id', dbMatch.round_id)
          .eq('result', 'win');
        
        // Add matchday filter for Group Stage (round 1)
        if (roundNumber === 1 && matchday) {
          winningPicksQuery = winningPicksQuery.eq('matchday', matchday);
        }
        
        const { data: winningPicks } = await winningPicksQuery;

        for (const pick of winningPicks || []) {
          picksProcessed++;
          
          let totalPointsForPick = pointsForWin;

          // ── Score bonus for QF, SF, Final (rounds 4, 5, 6) ──
          if (roundNumber >= 4 && 
              pick.predicted_home_score !== null && 
              pick.predicted_away_score !== null &&
              parseInt(pick.predicted_home_score) === homeScore &&
              parseInt(pick.predicted_away_score) === awayScore) {
            
            // Award 3 bonus points for correct score
            await supabase
              .from('picks')
              .update({ score_bonus: 3, points: pointsForWin + 3 })
              .eq('id', pick.id);

            totalPointsForPick = pointsForWin + 3;
          }

          // Increment points in tournament entries
          await supabase.rpc('increment_points', { 
            user_id: pick.user_id, 
            points: totalPointsForPick 
          });
          pointsAwarded += totalPointsForPick;
        }
      }

      // Mark losing picks (0 points)
      for (const losingTeamId of losingTeamIds) {
        let lossUpdateQuery = supabase
          .from('picks')
          .update({ result: 'loss', points: 0 })
          .eq('team_id', losingTeamId)
          .eq('round_id', dbMatch.round_id)
          .eq('result', 'pending');
        
        // Add matchday filter for Group Stage (round 1)
        if (roundNumber === 1 && matchday) {
          lossUpdateQuery = lossUpdateQuery.eq('matchday', matchday);
        }
        
        await lossUpdateQuery;
      }
    }

    return res.status(200).json({
      success: true,
      source: 'football-data.org',
      finishedFixturesFromAPI: finishedFixtures.length,
      matchesUpdated,
      picksProcessed,
      pointsAwarded,
      skipped: skipped.length > 0 ? skipped : null,
      message: `Updated ${matchesUpdated} matches. ${pointsAwarded} points awarded.`
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};