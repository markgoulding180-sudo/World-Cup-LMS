// Dashboard page JavaScript - v3: Multi-select pick flow (pick 3, then submit)

let currentMatchday = 1;
let allMatches = [];
let allTeams = [];
let userPicks = [];
let roundPicks = [];
let currentRound = null;
let tournamentId = null;
let selectedTeams = []; // Track selected teams for current matchday

async function loadDashboard() {
  const token = localStorage.getItem('wc_lms_token');
  
  try {
    const statusResponse = await fetch('/api/entries', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    let statusData = {};
    if (statusResponse.ok) {
      statusData = await statusResponse.json();
      updateStatusCard(statusData);
    }
    
    const roundsResponse = await fetch('/api/rounds');
    if (roundsResponse.ok) {
      const roundsData = await roundsResponse.json();
      currentRound = roundsData.rounds?.find(r => r.status === 'open') || roundsData.rounds?.[0];
    }
    
    const tourneyResponse = await fetch('/api/tournaments');
    if (tourneyResponse.ok) {
      const tourneyData = await tourneyResponse.json();
      tournamentId = tourneyData.tournaments?.[0]?.id;
    }
    
    const picksResponse = await fetch('/api/picks', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (picksResponse.ok) {
      const picksData = await picksResponse.json();
      userPicks = picksData.picks || [];
      roundPicks = currentRound ? userPicks.filter(p => p.round_id === currentRound.id) : [];
    }
    
    determineCurrentMatchday();
    
    const teamsResponse = await fetch('/api/teams');
    const matchesResponse = await fetch('/api/matches?limit=100');
    
    if (teamsResponse.ok && matchesResponse.ok) {
      const teamsData = await teamsResponse.json();
      const matchesData = await matchesResponse.json();
      
      allTeams = teamsData.teams || [];
      allMatches = matchesData.matches || [];
      
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
  const matchdayCounts = { 1: 0, 2: 0, 3: 0 };
  roundPicks.forEach(pick => {
    if (pick.matchday && matchdayCounts[pick.matchday] !== undefined) {
      matchdayCounts[pick.matchday]++;
    }
  });
  
  if (matchdayCounts[1] < 3) {
    currentMatchday = 1;
  } else if (matchdayCounts[2] < 3) {
    currentMatchday = 2;
  } else if (matchdayCounts[3] < 3) {
    currentMatchday = 3;
  } else {
    currentMatchday = 4;
  }
  
  // Reset selected teams when switching matchdays
  selectedTeams = [];
}

function displayMatchdayPickFlow() {
  const container = document.getElementById('available-teams');
  
  if (!currentRound) {
    container.innerHTML = '<p class="text-secondary">No active round available.</p>';
    return;
  }
  
  const statusDiv = document.getElementById('player-status');
  const isEntered = statusDiv && !statusDiv.querySelector('.not-entered');
  
  if (!isEntered) {
    container.innerHTML = `
      <div class="not-entered-message">
        <p>You need to enter the tournament before making picks.</p>
        <button class="btn btn-primary" onclick="enterTournament()">
          <i class="fas fa-ticket-alt"></i> Enter Tournament (£30)
        </button>
      </div>
    `;
    return;
  }
  
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
  
  const matchdayMatches = allMatches.filter(m => 
    m.round_id === currentRound.id && m.matchday === currentMatchday
  );
  
  if (matchdayMatches.length === 0) {
    container.innerHTML = `<p class="text-secondary">No matches found for Matchday ${currentMatchday}.</p>`;
    return;
  }
  
  const matchdayTeamIds = new Set();
  matchdayMatches.forEach(m => {
    matchdayTeamIds.add(m.home_team_id);
    matchdayTeamIds.add(m.away_team_id);
  });
  
  const usedTeamIds = new Set(roundPicks.map(p => p.team_id));
  const availableMatchdayTeams = allTeams.filter(t => 
    matchdayTeamIds.has(t.id) && !usedTeamIds.has(t.id)
  );
  
  const picksInCurrentMatchday = roundPicks.filter(p => p.matchday === currentMatchday).length;
  const remainingPicks = 3 - picksInCurrentMatchday;
  
  let html = `
    <div class="matchday-flow">
      <div class="matchday-header">
        <h3>Matchday ${currentMatchday} of 3</h3>
        <div class="matchday-progress">
          <span class="picks-count">${picksInCurrentMatchday}</span>
          <span class="picks-total">/ 3 picks selected</span>
        </div>
      </div>
      
      <div class="matchday-progress-bar">
        <div class="progress-fill" style="width: ${(picksInCurrentMatchday / 3) * 100}%"></div>
      </div>
      
      <p class="matchday-instruction">
        Select <strong>${remainingPicks}</strong> teams below, then click Submit.
        <br><small>Each team can only be used once across all matchdays.</small>
      </p>
      
      <div class="selected-teams-preview" id="selected-preview" style="display: none;">
        <h4>Your Selections:</h4>
        <div id="selected-teams-list"></div>
        <button class="btn btn-primary btn-lg" onclick="submitMatchdayPicks()">
          <i class="fas fa-check"></i> Submit Matchday ${currentMatchday} Picks
        </button>
        <button class="btn btn-secondary" onclick="clearSelections()">
          <i class="fas fa-times"></i> Clear
        </button>
      </div>
  `;
  
  // Build match-based picker with team cards
  html += '<div class="match-picker-list">';
  
  matchdayMatches.forEach(m => {
    const matchDate = new Date(m.match_time);
    const dateStr = matchDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    const homeTeam = allTeams.find(t => t.id === m.home_team_id);
    const awayTeam = allTeams.find(t => t.id === m.away_team_id);
    
    const homePicked = roundPicks.some(p => p.team_id === m.home_team_id);
    const awayPicked = roundPicks.some(p => p.team_id === m.away_team_id);
    const homeSelected = selectedTeams.includes(m.home_team_id);
    const awaySelected = selectedTeams.includes(m.away_team_id);
    
    html += `
      <div class="match-picker-card">
        <div class="match-picker-header">
          <span class="match-picker-date">${dateStr} @ ${timeStr}</span>
          <span class="match-picker-group">Group ${homeTeam?.group_name || '?'}</span>
        </div>
        <div class="match-picker-teams">
          <div class="match-picker-team ${homePicked ? 'picked' : ''} ${homeSelected ? 'selected' : ''}" 
               onclick="${homePicked ? '' : `toggleTeamSelection('${m.home_team_id}')`}">
            <img src="${homeTeam?.flag_url || ''}" alt="${homeTeam?.name}" class="match-picker-flag">
            <span class="match-picker-team-name">${homeTeam?.name || 'TBD'}</span>
            ${homePicked ? '<i class="fas fa-check match-picker-status"></i>' : ''}
            ${homeSelected ? '<i class="fas fa-check-circle match-picker-status selected"></i>' : ''}
          </div>
          <span class="match-picker-vs">VS</span>
          <div class="match-picker-team ${awayPicked ? 'picked' : ''} ${awaySelected ? 'selected' : ''}"
               onclick="${awayPicked ? '' : `toggleTeamSelection('${m.away_team_id}')`}">
            <img src="${awayTeam?.flag_url || ''}" alt="${awayTeam?.name}" class="match-picker-flag">
            <span class="match-picker-team-name">${awayTeam?.name || 'TBD'}</span>
            ${awayPicked ? '<i class="fas fa-check match-picker-status"></i>' : ''}
            ${awaySelected ? '<i class="fas fa-check-circle match-picker-status selected"></i>' : ''}
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
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
  
  html += '</div>';
  container.innerHTML = html;
  
  updateSelectedPreview();
}

function toggleTeamSelection(teamId) {
  const picksInMatchday = roundPicks.filter(p => p.matchday === currentMatchday).length;
  const maxSelectable = 3 - picksInMatchday;
  
  const index = selectedTeams.indexOf(teamId);
  
  if (index > -1) {
    // Deselect
    selectedTeams.splice(index, 1);
  } else {
    // Select (if under limit)
    if (selectedTeams.length < maxSelectable) {
      selectedTeams.push(teamId);
    } else {
      alert(`You can only select ${maxSelectable} team${maxSelectable !== 1 ? 's' : ''} for Matchday ${currentMatchday}`);
      return;
    }
  }
  
  displayMatchdayPickFlow();
}

function updateSelectedPreview() {
  const previewDiv = document.getElementById('selected-preview');
  const listDiv = document.getElementById('selected-teams-list');
  
  if (!previewDiv || !listDiv) return;
  
  if (selectedTeams.length === 0) {
    previewDiv.style.display = 'none';
    return;
  }
  
  previewDiv.style.display = 'block';
  
  const picksInMatchday = roundPicks.filter(p => p.matchday === currentMatchday).length;
  const needed = 3 - picksInMatchday;
  
  let html = '<div class="selected-teams-grid">';
  selectedTeams.forEach(teamId => {
    const team = allTeams.find(t => t.id === teamId);
    html += `
      <div class="selected-team-item">
        <img src="${team?.flag_url}" alt="" class="selected-flag">
        <span>${team?.name}</span>
      </div>
    `;
  });
  html += '</div>';
  
  if (selectedTeams.length < needed) {
    html += `<p class="selection-hint">Select ${needed - selectedTeams.length} more team${needed - selectedTeams.length !== 1 ? 's' : ''}</p>`;
  } else {
    // All 3 selected - scroll to Make Your Pick section to show submit button
    html += `<p class="selection-hint" style="color: var(--accent-green);"><i class="fas fa-check"></i> All 3 teams selected! Click Submit below.</p>`;
    setTimeout(() => {
      const pickSection = document.getElementById('pick-section');
      if (pickSection) {
        pickSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }
  
  listDiv.innerHTML = html;
}

function clearSelections() {
  selectedTeams = [];
  displayMatchdayPickFlow();
}

async function submitMatchdayPicks() {
  const token = localStorage.getItem('wc_lms_token');
  
  const picksInMatchday = roundPicks.filter(p => p.matchday === currentMatchday).length;
  const needed = 3 - picksInMatchday;
  
  if (selectedTeams.length < needed) {
    alert(`Please select ${needed} team${needed !== 1 ? 's' : ''} for Matchday ${currentMatchday}`);
    return;
  }
  
  const teamNames = selectedTeams.map(id => allTeams.find(t => t.id === id)?.name).join(', ');
  
  if (!confirm(`Submit these picks for Matchday ${currentMatchday}?\n\n${teamNames}`)) {
    return;
  }
  
  try {
    // Submit all picks
    const promises = selectedTeams.map(teamId => 
      fetch('/api/picks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          team_id: teamId,
          round_id: currentRound.id,
          tournament_id: tournamentId,
          matchday: currentMatchday
        })
      })
    );
    
    const responses = await Promise.all(promises);
    const allOk = responses.every(r => r.ok);
    
    if (allOk) {
      selectedTeams = []; // Clear selections
      
      if (currentMatchday < 3) {
        alert(`✓ Matchday ${currentMatchday} complete!\n\nMoving to Matchday ${currentMatchday + 1}...`);
      } else {
        alert(`✓ All picks submitted! Good luck!`);
      }
      
      loadDashboard();
    } else {
      alert('Some picks failed. Please try again.');
    }
  } catch (error) {
    alert('Error submitting picks: ' + error.message);
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
    const picksDisplay = Array.from({ length: data.max_lives || 9 }, (_, i) =>
      `<span class="life-heart ${i < (data.lives_remaining || 0) ? 'active' : 'lost'}">♥</span>`
    ).join('');
    
    statusDiv.innerHTML = `
      <div class="active">
        <i class="fas fa-check-circle"></i>
        <h3>Still In It!</h3>
        <div class="lives-display">${picksDisplay}</div>
        <p>${data.lives_remaining || 0} of ${data.max_lives || 9} picks remaining</p>
        <p>Current Matchday: ${data.current_matchday || currentMatchday}</p>
      </div>
    `;
  } else {
    statusDiv.innerHTML = `
      <div class="not-entered">
        <i class="fas fa-info-circle"></i>
        <h3>Not Entered</h3>
        <p>You need to enter the tournament to play</p>
        <button class="btn btn-primary" onclick="enterTournament()" style="margin-top: 1rem;">
          <i class="fas fa-ticket-alt"></i> Enter Tournament (£30)
        </button>
      </div>
    `;
  }
}

async function enterTournament() {
  const token = localStorage.getItem('wc_lms_token');
  
  if (!confirm('Enter the World Cup 2026 Last Man Standing tournament?\n\nEntry fee: £30\nMax 100 players\nPrize pool: Winner takes all!')) {
    return;
  }
  
  try {
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
  
  const roundMatches = matches?.filter(m => m.round_id === currentRound.id) || [];
  
  if (roundMatches.length === 0) {
    container.innerHTML = '<p class="text-secondary">No matches scheduled.</p>';
    return;
  }
  
  // Group by matchday
  const matchesByMatchday = { 1: [], 2: [], 3: [] };
  roundMatches.forEach(m => {
    if (m.matchday && matchesByMatchday[m.matchday]) {
      matchesByMatchday[m.matchday].push(m);
    }
  });
  
  let html = '<div class="matches-list-compact">';
  
  [1, 2, 3].forEach(matchday => {
    const matchdayMatches = matchesByMatchday[matchday];
    if (matchdayMatches.length === 0) return;
    
    html += `<div class="matchday-compact">`;
    html += `<h5>Matchday ${matchday}</h5>`;
    
    matchdayMatches.forEach(m => {
      const time = new Date(m.match_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const date = new Date(m.match_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      
      html += `
        <div class="match-compact-item">
          <span class="match-compact-time">${date} ${time}</span>
          <div class="match-compact-teams">
            <img src="${m.home_team?.flag_url}" alt="" class="match-compact-flag">
            <span class="${m.home_team_score !== null ? 'has-score' : ''}">${m.home_team?.name}</span>
            ${m.home_team_score !== null ? `<span class="match-score">${m.home_team_score}</span>` : ''}
            <span class="vs">vs</span>
            <span class="${m.away_team_score !== null ? 'has-score' : ''}">${m.away_team?.name}</span>
            ${m.away_team_score !== null ? `<span class="match-score">${m.away_team_score}</span>` : ''}
            <img src="${m.away_team?.flag_url}" alt="" class="match-compact-flag">
          </div>
        </div>
      `;
    });
    
    html += '</div>';
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  // Show selected tab
  document.getElementById(`tab-content-${tabName}`).style.display = 'block';
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

document.addEventListener('DOMContentLoaded', loadDashboard);
