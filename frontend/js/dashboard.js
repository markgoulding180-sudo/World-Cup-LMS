// Dashboard page JavaScript - v2: Structured 3-Step Matchday Pick Flow

// Current matchday state (1, 2, or 3 for group stage)
let currentMatchday = 1;
let allMatches = [];
let allTeams = [];
let userPicks = [];
let roundPicks = [];
let currentRound = null;
let tournamentId = null;

async function loadDashboard() {
  const token = localStorage.getItem('wc_lms_token');
  
  try {
    // Load player status
    const statusResponse = await fetch('/api/entries', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    let statusData = {};
    if (statusResponse.ok) {
      statusData = await statusResponse.json();
      updateStatusCard(statusData);
    }
    
    // Get current round info
    const roundsResponse = await fetch('/api/rounds');
    if (roundsResponse.ok) {
      const roundsData = await roundsResponse.json();
      currentRound = roundsData.rounds?.find(r => r.status === 'open') || roundsData.rounds?.[0];
    }
    
    // Get tournament
    const tourneyResponse = await fetch('/api/tournaments');
    if (tourneyResponse.ok) {
      const tourneyData = await tourneyResponse.json();
      tournamentId = tourneyData.tournaments?.[0]?.id;
    }
    
    // Load user's current picks for this round
    const picksResponse = await fetch('/api/picks', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (picksResponse.ok) {
      const picksData = await picksResponse.json();
      userPicks = picksData.picks || [];
      // Filter picks to current round only
      roundPicks = currentRound ? userPicks.filter(p => p.round_id === currentRound.id) : [];
    }
    
    // Determine current matchday based on picks made
    determineCurrentMatchday();
    
    // Load all teams and matches
    const teamsResponse = await fetch('/api/teams');
    const matchesResponse = await fetch('/api/matches?limit=100');
    
    if (teamsResponse.ok && matchesResponse.ok) {
      const teamsData = await teamsResponse.json();
      const matchesData = await matchesResponse.json();
      
      allTeams = teamsData.teams || [];
      allMatches = matchesData.matches || [];
      
      // Display the structured pick flow
      displayMatchdayPickFlow();
      displayCurrentPicks(roundPicks);
      displayRoundMatches(allMatches, currentRound);
    }
    
  } catch (error) {
    console.error('Dashboard error:', error);
    document.getElementById('player-status').innerHTML = '<p class="error">Error loading dashboard</p>';
  }
}

function determineCurrentMatchday() {
  // Count picks per matchday
  const matchdayCounts = { 1: 0, 2: 0, 3: 0 };
  roundPicks.forEach(pick => {
    if (pick.matchday && matchdayCounts[pick.matchday] !== undefined) {
      matchdayCounts[pick.matchday]++;
    }
  });
  
  // Determine which matchday we're on
  if (matchdayCounts[1] < 3) {
    currentMatchday = 1;
  } else if (matchdayCounts[2] < 3) {
    currentMatchday = 2;
  } else if (matchdayCounts[3] < 3) {
    currentMatchday = 3;
  } else {
    currentMatchday = 4; // All matchdays complete
  }
}

function displayMatchdayPickFlow() {
  const container = document.getElementById('available-teams');
  
  if (!currentRound) {
    container.innerHTML = '<p class="text-secondary">No active round available.</p>';
    return;
  }
  
  // Check if user has entered tournament
  const statusDiv = document.getElementById('player-status');
  const isEntered = statusDiv && !statusDiv.querySelector('.not-entered');
  
  if (!isEntered) {
    container.innerHTML = `
      <div class="not-entered-message">
        <p>You need to enter the tournament before making picks.</p>
        <button class="btn btn-primary" onclick="enterTournament()">
          <i class="fas fa-ticket-alt"></i> Enter Tournament (£20)
        </button>
      </div>
    `;
    return;
  }
  
  // Check if all matchdays are complete
  if (currentMatchday > 3) {
    container.innerHTML = `
      <div class="all-picks-complete">
        <i class="fas fa-check-circle"></i>
        <h3>All Picks Submitted!</h3>
        <p>You have made all 9 picks for the Group Stage (3 per matchday).</p>
        <p>Good luck!</p>
      </div>
    `;
    return;
  }
  
  // Get matches for current matchday
  const matchdayMatches = allMatches.filter(m => 
    m.round_id === currentRound.id && m.matchday === currentMatchday
  );
  
  if (matchdayMatches.length === 0) {
    container.innerHTML = `<p class="text-secondary">No matches found for Matchday ${currentMatchday}.</p>`;
    return;
  }
  
  // Get teams playing in this matchday
  const matchdayTeamIds = new Set();
  matchdayMatches.forEach(m => {
    matchdayTeamIds.add(m.home_team_id);
    matchdayTeamIds.add(m.away_team_id);
  });
  
  // Filter to available teams (not picked in any matchday of this round)
  const usedTeamIds = new Set(roundPicks.map(p => p.team_id));
  const availableMatchdayTeams = allTeams.filter(t => 
    matchdayTeamIds.has(t.id) && !usedTeamIds.has(t.id)
  );
  
  // Count picks made for current matchday
  const picksInCurrentMatchday = roundPicks.filter(p => p.matchday === currentMatchday).length;
  
  // Build the matchday pick UI
  let html = `
    <div class="matchday-flow">
      <div class="matchday-header">
        <h3>Matchday ${currentMatchday} of 3</h3>
        <div class="matchday-progress">
          <span class="picks-count">${picksInCurrentMatchday}</span>
          <span class="picks-total">/ 3 picks</span>
        </div>
      </div>
      
      <div class="matchday-progress-bar">
        <div class="progress-fill" style="width: ${(picksInCurrentMatchday / 3) * 100}%"></div>
      </div>
      
      <p class="matchday-instruction">
        Select <strong>${3 - picksInCurrentMatchday}</strong> more team${3 - picksInCurrentMatchday !== 1 ? 's' : ''} to win their matches.
        <br><small>Each team can only be used once across all matchdays.</small>
      </p>
  `;
  
  // Show matches for this matchday
  html += '<div class="matchday-matches">';
  matchdayMatches.forEach(m => {
    const matchDate = new Date(m.match_time);
    const dateStr = matchDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    const homeTeam = allTeams.find(t => t.id === m.home_team_id);
    const awayTeam = allTeams.find(t => t.id === m.away_team_id);
    
    const homePicked = roundPicks.some(p => p.team_id === m.home_team_id);
    const awayPicked = roundPicks.some(p => p.team_id === m.away_team_id);
    
    html += `
      <div class="matchday-match-card">
        <div class="match-info">
          <span class="match-date">${dateStr} @ ${timeStr}</span>
          <span class="match-group">Group ${homeTeam?.group_name || '?'}</span>
        </div>
        <div class="match-teams">
          <div class="matchday-team ${homePicked ? 'picked' : ''}" 
               onclick="${homePicked ? '' : `selectMatchdayTeam('${m.home_team_id}', ${currentMatchday})`}">
            <img src="${homeTeam?.flag_url || ''}" alt="" class="team-flag-small">
            <span class="team-name-short">${homeTeam?.name || 'TBD'}</span>
            ${homePicked ? '<i class="fas fa-check pick-indicator"></i>' : ''}
          </div>
          <span class="vs">vs</span>
          <div class="matchday-team ${awayPicked ? 'picked' : ''}"
               onclick="${awayPicked ? '' : `selectMatchdayTeam('${m.away_team_id}', ${currentMatchday})`}">
            <img src="${awayTeam?.flag_url || ''}" alt="" class="team-flag-small">
            <span class="team-name-short">${awayTeam?.name || 'TBD'}</span>
            ${awayPicked ? '<i class="fas fa-check pick-indicator"></i>' : ''}
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  
  // Show upcoming matchdays status
  html += `
    <div class="upcoming-matchdays">
      <h4>Your Progress</h4>
      <div class="matchday-status-list">
        <div class="matchday-status ${currentMatchday === 1 ? 'active' : (roundPicks.some(p => p.matchday === 1) ? 'complete' : '')}">
          <span class="status-dot"></span>
          <span class="status-label">Matchday 1</span>
          <span class="status-count">${roundPicks.filter(p => p.matchday === 1).length}/3</span>
        </div>
        <div class="matchday-status ${currentMatchday === 2 ? 'active' : (roundPicks.some(p => p.matchday === 2) ? 'complete' : '')}">
          <span class="status-dot"></span>
          <span class="status-label">Matchday 2</span>
          <span class="status-count">${roundPicks.filter(p => p.matchday === 2).length}/3</span>
        </div>
        <div class="matchday-status ${currentMatchday === 3 ? 'active' : (roundPicks.some(p => p.matchday === 3) ? 'complete' : '')}">
          <span class="status-dot"></span>
          <span class="status-label">Matchday 3</span>
          <span class="status-count">${roundPicks.filter(p => p.matchday === 3).length}/3</span>
        </div>
      </div>
    </div>
  `;
  
  html += '</div>'; // Close matchday-flow
  
  container.innerHTML = html;
}

async function selectMatchdayTeam(teamId, matchday) {
  const token = localStorage.getItem('wc_lms_token');
  
  // Check if already at pick limit for this matchday
  const picksInMatchday = roundPicks.filter(p => p.matchday === matchday).length;
  if (picksInMatchday >= 3) {
    alert(`You have already made 3 picks for Matchday ${matchday}!`);
    return;
  }
  
  // Get team name for confirmation
  const team = allTeams.find(t => t.id === teamId);
  if (!team) return;
  
  if (!confirm(`Pick ${team.name} to win their Matchday ${matchday} match?\n\n(${picksInMatchday + 1} of 3 picks for this matchday)`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/picks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        team_id: teamId,
        round_id: currentRound.id,
        tournament_id: tournamentId,
        matchday: matchday
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Check if matchday is now complete
      if (data.matchdayComplete) {
        if (data.nextMatchday) {
          alert(`✓ Matchday ${matchday} complete!\n\nMoving to Matchday ${data.nextMatchday}...`);
        } else {
          alert(`✓ All picks submitted! Good luck!`);
        }
      } else {
        // Show progress toast or update
        const remaining = 3 - data.picksInMatchday;
        console.log(`${remaining} pick${remaining !== 1 ? 's' : ''} remaining for Matchday ${matchday}`);
      }
      
      // Reload dashboard to show updated state
      loadDashboard();
    } else {
      alert(data.error || 'Failed to make pick');
    }
  } catch (error) {
    alert('Error making pick: ' + error.message);
  }
}

function displayCurrentPicks(picks) {
  const container = document.getElementById('current-pick');
  if (!container) return;
  
  const picksMade = picks.length;
  
  if (picksMade === 0) {
    container.innerHTML = `
      <div class="current-pick-card">
        <h3>Your Group Stage Picks</h3>
        <p class="text-secondary">No picks yet. You need to make 9 picks total (3 per matchday).</p>
      </div>
    `;
    return;
  }
  
  // Group picks by matchday
  const picksByMatchday = { 1: [], 2: [], 3: [] };
  picks.forEach(pick => {
    if (pick.matchday && picksByMatchday[pick.matchday]) {
      picksByMatchday[pick.matchday].push(pick);
    }
  });
  
  let html = `
    <div class="current-pick-card">
      <h3>Your Group Stage Picks</h3>
      <p>Total: ${picksMade} / 9 picks</p>
  `;
  
  [1, 2, 3].forEach(matchday => {
    const matchdayPicks = picksByMatchday[matchday];
    html += `<div class="matchday-picks-section">`;
    html += `<h4>Matchday ${matchday} <span class="pick-count">(${matchdayPicks.length}/3)</span></h4>`;
    
    if (matchdayPicks.length === 0) {
      html += '<p class="no-picks">No picks yet</p>';
    } else {
      html += '<div class="picks-list-small">';
      html += matchdayPicks.map(pick => `
        <div class="pick-item-small">
          <img src="${pick.teams?.flag_url}" alt="" class="pick-flag-small">
          <div class="pick-details">
            <span class="pick-team-name">${pick.teams?.name}</span>
          </div>
          <span class="pick-status-badge ${pick.result}">${pick.result}</span>
        </div>
      `).join('');
      html += '</div>';
    }
    html += '</div>';
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function updateStatusCard(data) {
  const statusDiv = document.getElementById('player-status');
  
  if (data.status === 'eliminated') {
    statusDiv.innerHTML = `
      <div class="eliminated">
        <i class="fas fa-times-circle"></i>
        <h3>Eliminated</h3>
        <p>You were eliminated in Round ${data.eliminated_round}</p>
      </div>
    `;
  } else if (data.status === 'active') {
    // Build hearts display
    const heartsDisplay = Array.from({ length: data.max_lives || 3 }, (_, i) =>
      `<span class="life-heart ${i < (data.lives_remaining || 0) ? 'active' : 'lost'}">♥</span>`
    ).join('');
    
    statusDiv.innerHTML = `
      <div class="active">
        <i class="fas fa-check-circle"></i>
        <h3>Still In It!</h3>
        <div class="lives-display">${heartsDisplay}</div>
        <p>${data.lives_remaining || 0} of ${data.max_lives || 3} lives remaining</p>
        <p>Current Round: ${data.current_round}</p>
      </div>
    `;
  } else {
    statusDiv.innerHTML = `
      <div class="not-entered">
        <i class="fas fa-info-circle"></i>
        <h3>Not Entered</h3>
        <p>You need to enter the tournament to play</p>
        <button class="btn btn-primary" onclick="enterTournament()" style="margin-top: 1rem;">
          <i class="fas fa-ticket-alt"></i> Enter Tournament (£20)
        </button>
      </div>
    `;
  }
}

async function enterTournament() {
  const token = localStorage.getItem('wc_lms_token');
  
  if (!confirm('Enter the World Cup 2026 Last Man Standing tournament?\n\nEntry fee: £20\nPrize pool: Winner takes all!')) {
    return;
  }
  
  try {
    // Get the first tournament
    const tourneyResponse = await fetch('/api/tournaments');
    const tourneyData = await tourneyResponse.json();
    
    if (!tourneyData.tournaments || tourneyData.tournaments.length === 0) {
      alert('No tournament available. Please contact admin.');
      return;
    }
    
    const tournamentId = tourneyData.tournaments[0].id;
    
    const response = await fetch('/api/entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ tournament_id: tournamentId })
    });
    
    if (response.ok) {
      alert('You have entered the tournament! Good luck!');
      loadDashboard();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to enter tournament');
    }
  } catch (error) {
    alert('Error entering tournament: ' + error.message);
  }
}

function displayRoundMatches(matches, currentRound) {
  const container = document.getElementById('round-matches');
  if (!container || !currentRound) return;
  
  // Filter matches to current round
  const roundMatches = matches?.filter(m => m.round_id === currentRound.id) || [];
  
  if (roundMatches.length === 0) {
    container.innerHTML = '<p class="text-secondary">No matches scheduled for this round yet.</p>';
    return;
  }
  
  // Group matches by matchday
  const matchesByMatchday = { 1: [], 2: [], 3: [] };
  roundMatches.forEach(m => {
    if (m.matchday && matchesByMatchday[m.matchday]) {
      matchesByMatchday[m.matchday].push(m);
    }
  });
  
  let html = '<div class="round-matches-list">';
  html += `<h3>${currentRound.name} - All Matches</h3>`;
  
  [1, 2, 3].forEach(matchday => {
    const matchdayMatches = matchesByMatchday[matchday];
    if (matchdayMatches.length === 0) return;
    
    html += `<div class="matchday-section">`;
    html += `<h4>Matchday ${matchday}</h4>`;
    
    matchdayMatches.forEach(m => {
      const time = new Date(m.match_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const date = new Date(m.match_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      
      html += `
        <div class="match-item">
          <span class="match-time">${date} ${time}</span>
          <div class="match-teams-row">
            <img src="${m.home_team?.flag_url}" alt="" class="match-flag">
            <span>${m.home_team?.name}</span>
            <span class="vs">vs</span>
            <span>${m.away_team?.name}</span>
            <img src="${m.away_team?.flag_url}" alt="" class="match-flag">
          </div>
        </div>
      `;
    });
    
    html += '</div>';
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Legacy function - kept for compatibility
function switchMatchDay(dayIndex) {
  // No longer needed with new flow
}

// Load dashboard on page load
document.addEventListener('DOMContentLoaded', loadDashboard);
