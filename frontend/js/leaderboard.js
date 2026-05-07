// Leaderboard page JavaScript

async function loadLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard');
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Leaderboard error:', data.error);
      return;
    }
    
    displayStats(data.stats);
    displayActivePlayers(data.leaderboard);
    displayEliminatedPlayers(data.leaderboard);
    
  } catch (error) {
    console.error('Error loading leaderboard:', error);
  }
}

function displayStats(stats) {
  // Could add a stats section at top
  console.log('Stats:', stats);
}

function displayActivePlayers(leaderboard) {
  const container = document.getElementById('active-players');
  const activePlayers = leaderboard.filter(p => p.status === 'active');
  
  if (activePlayers.length === 0) {
    container.innerHTML = '<p class="text-secondary">No active players yet.</p>';
    return;
  }
  
  let html = '<div class="leaderboard-list">';
  
  activePlayers.forEach((player, index) => {
    html += `
      <div class="leaderboard-item active">
        <div class="position">${player.position}</div>
        <div class="player-info">
          <strong>${player.display_name}</strong>
          <span class="username">@${player.username}</span>
        </div>
        <div class="current-pick">
          ${player.current_pick ? `
            <img src="${player.current_pick.flag}" alt="" class="pick-flag-small">
            <span>${player.current_pick.team}</span>
          ` : '<span class="no-pick">No pick</span>'}
        </div>
        <span class="status-badge active">Still Standing</span>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function displayEliminatedPlayers(leaderboard) {
  const container = document.getElementById('eliminated-players');
  const eliminatedPlayers = leaderboard.filter(p => p.status === 'eliminated');
  
  if (eliminatedPlayers.length === 0) {
    container.innerHTML = '<p class="text-secondary">No eliminated players yet.</p>';
    return;
  }
  
  let html = '<div class="leaderboard-list">';
  
  eliminatedPlayers.forEach((player, index) => {
    html += `
      <div class="leaderboard-item eliminated">
        <div class="position">-</div>
        <div class="player-info">
          <strong>${player.display_name}</strong>
          <span class="username">@${player.username}</span>
        </div>
        <div class="eliminated-info">
          <span>Eliminated Round ${player.eliminated_round}</span>
        </div>
        <span class="status-badge eliminated">Eliminated</span>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Load on page load
document.addEventListener('DOMContentLoaded', loadLeaderboard);
