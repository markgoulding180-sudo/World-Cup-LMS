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
    const tourneyResponse = await fetch('/api/teams');
    const tourneyData = await tourneyResponse.json();
    
    // For now, use tournament_id 1 (we'll need to get this properly)
    const response = await fetch('/api/entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ tournament_id: '00000000-0000-0000-0000-000000000001' })
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
    const response = await fetch('/api/picks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ team_id: teamId })
    });
    
    if (response.ok) {
      alert('Team selected!');
      loadDashboard();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to select team');
    }
  } catch (error) {
    alert('Error selecting team');
  }
}

// Load dashboard on page load
document.addEventListener('DOMContentLoaded', loadDashboard);
