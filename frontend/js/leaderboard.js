// Leaderboard page JavaScript

async function loadLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard');
    
    if (response.ok) {
      const data = await response.json();
      displayLeaderboard(data);
    }
  } catch (error) {
    console.error('Leaderboard error:', error);
  }
}

function displayLeaderboard(data) {
  // Active players
  const activeDiv = document.getElementById('active-players');
  if (data.active && data.active.length > 0) {
    let html = '<table class="leaderboard-table">';
    html += '<tr><th>Position</th><th>Player</th><th>Round</th></tr>';
    
    data.active.forEach((player, index) => {
      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${player.display_name}</td>
          <td>${player.current_round}</td>
        </tr>
      `;
    });
    
    html += '</table>';
    activeDiv.innerHTML = html;
  } else {
    activeDiv.innerHTML = '<p>No active players</p>';
  }
  
  // Eliminated players
  const eliminatedDiv = document.getElementById('eliminated-players');
  if (data.eliminated && data.eliminated.length > 0) {
    let html = '<table class="leaderboard-table">';
    html += '<tr><th>Player</th><th>Eliminated Round</th></tr>';
    
    data.eliminated.forEach(player => {
      html += `
        <tr>
          <td>${player.display_name}</td>
          <td>Round ${player.eliminated_round}</td>
        </tr>
      `;
    });
    
    html += '</table>';
    eliminatedDiv.innerHTML = html;
  } else {
    eliminatedDiv.innerHTML = '<p>No eliminated players yet</p>';
  }
}

// Load leaderboard on page load
document.addEventListener('DOMContentLoaded', loadLeaderboard);
