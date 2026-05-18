// Script to import World Cup 2026 data from openfootball
// Run this in browser console or as a Vercel function

const WORLD_CUP_DATA_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

async function importWorldCupData() {
  try {
    // Fetch the data
    const response = await fetch(WORLD_CUP_DATA_URL);
    const data = await response.json();
    
    console.log('World Cup 2026 data loaded:', data.name);
    console.log('Total matches:', data.matches.length);
    
    // Extract unique teams
    const teams = new Map();
    data.matches.forEach(match => {
      if (!teams.has(match.team1)) {
        teams.set(match.team1, { name: match.team1, group: match.group });
      }
      if (!teams.has(match.team2)) {
        teams.set(match.team2, { name: match.team2, group: match.group });
      }
    });
    
    console.log('Unique teams:', teams.size);
    console.log('Teams:', Array.from(teams.keys()));
    
    // Return structured data
    return {
      name: data.name,
      teams: Array.from(teams.entries()).map(([name, info]) => ({
        name,
        group: info.group?.replace('Group ', '') || 'A',
        code: name.substring(0, 3).toUpperCase()
      })),
      matches: data.matches.map((match, index) => ({
        round: match.round,
        match_number: index + 1,
        date: match.date,
        time: match.time,
        home_team: match.team1,
        away_team: match.team2,
        group: match.group,
        ground: match.ground
      }))
    };
    
  } catch (error) {
    console.error('Error loading World Cup data:', error);
  }
}

// Run it
importWorldCupData().then(data => {
  console.log('Processed data:', data);
});
