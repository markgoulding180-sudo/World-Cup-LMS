// Dashboard page JavaScript

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
    let currentRound = null;
    let picksRequired = 3;
    if (roundsResponse.ok) {
      const roundsData = await roundsResponse.json();
      currentRound = roundsData.rounds?.find(r => r.status === 'open') || roundsData.rounds?.[0];
      picksRequired = currentRound?.picks_required || 3;
    }
    
    // Load user's current picks for this round
    const picksResponse = await fetch('/api/picks', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    let userPicks = [];
    let roundPicks = [];
    if (picksResponse.ok) {
      const picksData = await picksResponse.json();
      userPicks = picksData.picks || [];
      // Filter picks to current round only
      roundPicks = currentRound ? userPicks.filter(p => p.round_id === currentRound.id) : [];
    }
    
    // Load all teams for group stage rounds
    // In group stage, all 48 teams play across the 3 matchdays
    // Players pick from all available teams
    const teamsResponse = await fetch('/api/teams');
    if (teamsResponse.ok) {
      const teamsData = await teamsResponse.json();
      displayAvailableTeams(teamsData.teams, userPicks, roundPicks.length, picksRequired);
      displayCurrentPicks(roundPicks, picksRequired);
    }
    
  } catch (error) {
    console.error('Dashboard error:', error);
    document.getElementById('player-status').innerHTML = '<p class="error">Error loading dashboard</p>';
  }
}

function displayCurrentPicks(picks, picksRequired) {
  const container = document.getElementById('current-pick');
  if (!container) return;
  
  const picksMade = picks.length;
  
  if (picksMade === 0) {
    container.innerHTML = `
      <div class="current-pick-card">
        <h3>Your Picks This Round</h3>
        <p class="text-secondary">No picks yet. You need to make ${picksRequired} pick(s).</p>
        <p>Picks: 0 / ${picksRequired}</p>
      </div>
    `;
    return;
  }
  
  let picksHtml = picks.map(pick => `
    <div class="pick-item-small">
      <img src="${pick.teams?.flag_url}" alt="" class="pick-flag-small">
      <span>${pick.teams?.name}</span>
      <span class="pick-status-badge ${pick.result}">${pick.result}</span>
    </div>
  `).join('');
  
  container.innerHTML = `
    <div class="current-pick-card">
      <h3>Your Picks This Round</h3>
      <p>Picks: ${picksMade} / ${picksRequired}</p>
      <div class="picks-list-small">${picksHtml}</div>
    </div>
  `;
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

let allTeams = [];
let currentGroup = 'ALL';
let currentPicksCount = 0;
let maxPicksAllowed = 3;

function displayAvailableTeams(teams, allUserPicks, picksMade, picksRequired) {
  const container = document.getElementById('available-teams');
  
  currentPicksCount = picksMade;
  maxPicksAllowed = picksRequired;
  
  if (!teams || teams.length === 0) {
    container.innerHTML = '<p>No teams available for this round</p>';
    return;
  }
  
  // Filter out teams already picked in previous rounds
  const usedTeamIds = new Set(allUserPicks.map(p => p.team_id));
  const availableTeams = teams.filter(t => !usedTeamIds.has(t.id));
  
  allTeams = availableTeams;
  
  // Show picks progress
  let html = `<div class="picks-progress">Picks: ${picksMade} / ${picksRequired}</div>`;
  
  if (picksMade >= picksRequired) {
    html += '<div class="picks-complete">✓ All picks submitted for this round!</div>';
    container.innerHTML = html;
    return;
  }
  
  // Get unique groups
  const groups = [...new Set(availableTeams.map(t => t.group_name))].sort();
  
  html += '<div class="group-filter">';
  html += `<button class="group-btn ${currentGroup === 'ALL' ? 'active' : ''}" onclick="filterTeams('ALL')">All Groups</button>`;
  groups.forEach(group => {
    html += `<button class="group-btn ${currentGroup === group ? 'active' : ''}" onclick="filterTeams('${group}')">Group ${group}</button>`;
  });
  html += '</div>';
  
  html += '<div class="teams-grid" id="teams-grid">';
  html += renderTeamCards(availableTeams);
  html += '</div>';
  
  container.innerHTML = html;
}

function renderTeamCards(teams) {
  const filteredTeams = currentGroup === 'ALL' 
    ? teams 
    : teams.filter(t => t.group_name === currentGroup);
  
  if (filteredTeams.length === 0) {
    return '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No teams in this group</p>';
  }
  
  return filteredTeams.map(team => {
    const eliminatedClass = team.eliminated ? 'eliminated' : '';
    return `
      <div class="team-card ${eliminatedClass}" onclick="${team.eliminated ? '' : `selectTeam('${team.id}')`}">
        <img src="${team.flag_url || 'https://flagcdn.com/w80/xx.png'}" alt="${team.name}" class="team-flag" onerror="this.src='https://flagcdn.com/w80/xx.png'">
        <span class="team-name">${team.name}</span>
        <span class="team-group">Group ${team.group_name}</span>
      </div>
    `;
  }).join('');
}

function filterTeams(group) {
  currentGroup = group;
  const grid = document.getElementById('teams-grid');
  if (grid) {
    grid.innerHTML = renderTeamCards(allTeams);
  }
  
  // Update active button
  document.querySelectorAll('.group-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent === (group === 'ALL' ? 'All Groups' : `Group ${group}`)) {
      btn.classList.add('active');
    }
  });
}

async function selectTeam(teamId) {
  const token = localStorage.getItem('wc_lms_token');
  
  // Check if already at pick limit
  if (currentPicksCount >= maxPicksAllowed) {
    alert(`You have already made ${maxPicksAllowed} pick(s) for this round!`);
    return;
  }
  
  if (!confirm(`Select this team for the current round? (${currentPicksCount + 1} of ${maxPicksAllowed})`)) return;
  
  try {
    // Check if user is entered in tournament first
    const statusResponse = await fetch('/api/entries', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statusData = await statusResponse.json();
    
    if (statusData.status !== 'active') {
      alert('You must enter the tournament before making a pick!\n\nClick "Enter Tournament (£20)" button first.');
      return;
    }
    
    // Get tournaments to find active one
    const tourneyResponse = await fetch('/api/tournaments');
    const tourneyData = await tourneyResponse.json();
    
    if (!tourneyData.tournaments || tourneyData.tournaments.length === 0) {
      alert('No active tournament found');
      return;
    }
    
    const tournamentId = tourneyData.tournaments[0].id;
    
    // Get rounds to find current round
    const roundsResponse = await fetch('/api/rounds');
    const roundsData = await roundsResponse.json();
    
    // Find the first open round, or default to round 1
    let roundId = null;
    if (roundsData.rounds) {
      const openRound = roundsData.rounds.find(r => r.status === 'open');
      roundId = openRound ? openRound.id : roundsData.rounds[0]?.id;
    }
    
    if (!roundId) {
      alert('No active round found');
      return;
    }
    
    const response = await fetch('/api/picks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        team_id: teamId,
        round_id: roundId,
        tournament_id: tournamentId
      })
    });
    
    if (response.ok) {
      alert('Team selected!');
      loadDashboard();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to select team');
    }
  } catch (error) {
    alert('Error selecting team: ' + error.message);
  }
}

// Load dashboard on page load
document.addEventListener('DOMContentLoaded', loadDashboard);
