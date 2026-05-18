// Vercel Function: Auto-update results from football-data.org
// Replaces fixturedownload.com which has large delays on results
// football-data.org updates within minutes of full time
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
  "Côte d'Ivoire": 'Ivory Coast',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'United States': 'USA',
  'USA': 'United States',
  'Korea DPR': 'North Korea',
  'Kyrgyz Republic': 'Kyrgyzstan'
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
        livesDeducted: 0,
        playersEliminated: 0
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
      .select('id, home_team_id, away_team_id, status, round_id, matchday')
      .eq('status', 'upcoming');

    let matchesUpdated = 0;
    let picksProcessed = 0;
    let livesDeducted = 0;
    let playersEliminated = 0;
    const skipped = [];

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

      // Mark winning picks
      if (winningTeamId) {
        await supabase
          .from('picks')
          .update({ result: 'win' })
          .eq('team_id', winningTeamId)
          .eq('result', 'pending');
      }

      // Mark losing picks
      for (const losingTeamId of losingTeamIds) {
        await supabase
          .from('picks')
          .update({ result: 'loss' })
          .eq('team_id', losingTeamId)
          .eq('result', 'pending');
      }

      // ── Deduct lives for each losing pick ────────────
      for (const losingTeamId of losingTeamIds) {
        const { data: losingPicks } = await supabase
          .from('picks')
          .select('user_id')
          .eq('result', 'loss')
          .eq('team_id', losingTeamId);

        for (const pick of losingPicks || []) {
          picksProcessed++;

          const { data: entry } = await supabase
            .from('tournament_entries')
            .select('lives_remaining, tournament_id')
            .eq('user_id', pick.user_id)
            .single();

          if (entry && entry.lives_remaining > 0) {
            const newLives = Math.max(0, entry.lives_remaining - 1);
            livesDeducted++;

            await supabase
              .from('tournament_entries')
              .update({
                lives_remaining: newLives,
                ...(newLives === 0 ? {
                  status: 'eliminated',
                  eliminated_at: new Date().toISOString()
                } : {})
              })
              .eq('user_id', pick.user_id)
              .eq('tournament_id', entry.tournament_id);

            if (newLives === 0) playersEliminated++;
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      source: 'football-data.org',
      finishedFixturesFromAPI: finishedFixtures.length,
      matchesUpdated,
      picksProcessed,
      livesDeducted,
      playersEliminated,
      skipped: skipped.length > 0 ? skipped : null,
      message: `Updated ${matchesUpdated} matches. ${livesDeducted} lives deducted. ${playersEliminated} players eliminated.`
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
