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
    statusDiv.innerHTML = '<p>Not entered in current tournament</p>';
  }
}

function displayAvailableTeams(teams) {
  const container = document.getElementById('available-teams');
  
  if (!teams || teams.length === 0) {
    container.innerHTML = '<p>No teams available</p>';
    return;
  }
  
  let html = '<div class="teams-grid">';
  
  teams.forEach(team => {
    if (!team.eliminated) {
      html += `
        <div class="team-card" onclick="selectTeam('${team.id}')">
          <img src="${team.flag_url}" alt="${team.name}" class="team-flag">
          <span class="team-name">${team.name}</span>
          <span class="team-group">Group ${team.group_name}</span>
        </div>
      `;
    }
  });
  
  html += '</div>';
  container.innerHTML = html;
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
