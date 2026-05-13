// Import script for fixturedownload.com API
// Fetches World Cup 2026 data and maps flags from master_teams

const FIXTURE_URL = 'https://fixturedownload.com/feed/json/fifa-world-cup-2026';

// Team name mappings (fixturedownload -> your naming)
const TEAM_MAPPINGS = {
  'Korea Republic': 'South Korea',
  'Czechia': 'Czech Republic',
  'IR Iran': 'Iran',
  'Türkiye': 'Turkey',
  'Congo DR': 'DR Congo',
  'Cabo Verde': 'Cape Verde',
  "Côte d'Ivoire": 'Ivory Coast',
  'USA': 'United States',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina'
};

async function importFromFixturedownload() {
  try {
    console.log('Fetching from fixturedownload...');
    const response = await fetch(FIXTURE_URL);
    const fixtures = await response.json();
    
    // Filter group stage only (RoundNumber 1-3)
    const groupStage = fixtures.filter(f => f.RoundNumber >= 1 && f.RoundNumber <= 3);
    
    console.log(`Found ${groupStage.length} group stage matches`);
    
    // Extract unique teams
    const teamsMap = new Map();
    groupStage.forEach(match => {
      const homeName = TEAM_MAPPINGS[match.HomeTeam] || match.HomeTeam;
      const awayName = TEAM_MAPPINGS[match.AwayTeam] || match.AwayTeam;
      
      if (!teamsMap.has(homeName)) {
        teamsMap.set(homeName, { name: homeName, group: match.Group?.replace('Group ', '') || '' });
      }
      if (!teamsMap.has(awayName)) {
        teamsMap.set(awayName, { name: awayName, group: match.Group?.replace('Group ', '') || '' });
      }
    });
    
    console.log(`Found ${teamsMap.size} unique teams`);
    
    // Return structured data
    return {
      teams: Array.from(teamsMap.values()),
      matches: groupStage.map(match => ({
        match_number: match.MatchNumber,
        round: match.RoundNumber,
        date: match.DateUtc,
        home_team: TEAM_MAPPINGS[match.HomeTeam] || match.HomeTeam,
        away_team: TEAM_MAPPINGS[match.AwayTeam] || match.AwayTeam,
        group: match.Group?.replace('Group ', '') || '',
        location: match.Location,
        home_score: match.HomeTeamScore,
        away_score: match.AwayTeamScore
      }))
    };
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Run it
importFromFixturedownload().then(data => {
  console.log('Import ready:', data);
  console.log('\nTeams:', data.teams.map(t => t.name).join(', '));
  console.log('\nSample match:', data.matches[0]);
});
