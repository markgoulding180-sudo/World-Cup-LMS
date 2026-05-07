// Dashboard page JavaScript

async function loadDashboard() {
  const token = localStorage.getItem('wc_lms_token');
  
  try {
    // Load player status
    const statusResponse = await fetch('/api/entries', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      updateStatusCard(statusData);
    }
    
    // Load available teams
    const teamsResponse = await fetch('/api/teams');
    if (teamsResponse.ok) {
      const teamsData = await teamsResponse.json();
      displayAvailableTeams(teamsData.teams);
    }
    
  } catch (error) {
    console.error('Dashboard error:', error);
    document.getElementById('player-status').innerHTML = '<p class="error">Error loading dashboard</p>';
  }
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
    statusDiv.innerHTML = `
      <div class="active">
        <i class="fas fa-check-circle"></i>
        <h3>Still Standing!</h3>
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

function displayAvailableTeams(teams) {
  const container = document.getElementById('available-teams');
  
  if (!teams || teams.length === 0) {
    container.innerHTML = '<p>No teams available</p>';
    return;
  }
  
  allTeams = teams;
  
  // Get unique groups
  const groups = [...new Set(teams.map(t => t.group_name))].sort();
  
  let html = '<div class="group-filter">';
  html += `<button class="group-btn ${currentGroup === 'ALL' ? 'active' : ''}" onclick="filterTeams('ALL')">All Groups</button>`;
  groups.forEach(group => {
    html += `<button class="group-btn ${currentGroup === group ? 'active' : ''}" onclick="filterTeams('${group}')">Group ${group}</button>`;
  });
  html += '</div>';
  
  html += '<div class="teams-grid" id="teams-grid">';
  html += renderTeamCards(teams);
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
  
  if (!confirm('Select this team for the current round?')) return;
  
  try {
    // Get current round and tournament info first
    const statusResponse = await fetch('/api/entries', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statusData = await statusResponse.json();
    
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
