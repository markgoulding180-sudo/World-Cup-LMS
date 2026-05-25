// Leaderboard page JavaScript - Points-based system

// Points structure for reference
const POINTS_STRUCTURE = {
  1: 2,  // Group Stage = 2 points
  2: 4,  // Round of 32 = 4 points
  3: 6,  // Round of 16 = 6 points
  4: 8,  // Quarter Finals = 8 points
  5: 10, // Semi Finals = 10 points
  6: 15  // Final = 15 points
};

async function loadLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard');
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Leaderboard error:', data.error);
      return;
    }
    
    displayStats(data.stats);
    displayLeaderboard(data.leaderboard);
    
  } catch (error) {
    console.error('Error loading leaderboard:', error);
  }
}

function displayStats(stats) {
  const container = document.getElementById('leaderboard-stats');
  if (!container) return;
  
  container.innerHTML = `
    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-value">${stats?.total_players || 0}</div>
        <div class="stat-label">Players</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${stats?.active_players || 0}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${stats?.eliminated_players || 0}</div>
        <div class="stat-label">Eliminated</div>
      </div>
    </div>
  `;
}

function displayLeaderboard(leaderboard) {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;
  
  if (!leaderboard || leaderboard.length === 0) {
    container.innerHTML = '<p class="text-secondary">No players yet.</p>';
    return;
  }
  
  // Sort by total_points (highest first)
  const sortedLeaderboard = [...leaderboard].sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
  
  let html = '<div class="leaderboard-table">';
  
  // Header
  html += `
    <div class="leaderboard-header">
      <div class="col-rank">#</div>
      <div class="col-player">Player</div>
      <div class="col-points">Points</div>
      <div class="col-wins">Wins</div>
      <div class="col-pick">Current Pick</div>
      <div class="col-status">Status</div>
    </div>
  `;
  
  sortedLeaderboard.forEach((player, index) => {
    const position = index + 1;
    const isEliminated = player.status === 'eliminated';
    const totalPoints = player.total_points || 0;
    const wins = player.wins || 0;
    
    // Medal for top 3
    let rankDisplay = `<span class="rank-number">${position}</span>`;
    if (position === 1) rankDisplay = '<span class="rank-medal gold"><i class="fas fa-trophy"></i></span>';
    else if (position === 2) rankDisplay = '<span class="rank-medal silver"><i class="fas fa-medal"></i></span>';
    else if (position === 3) rankDisplay = '<span class="rank-medal bronze"><i class="fas fa-medal"></i></span>';
    
    // Current pick with points earned
    let currentPickHtml = '<span class="no-pick">-</span>';
    if (player.current_pick) {
      const pointsEarned = player.current_pick.points_earned;
      const pointsClass = pointsEarned > 0 ? 'points-won' : (pointsEarned === 0 ? 'points-lost' : 'points-pending');
      const pointsText = pointsEarned > 0 ? `+${pointsEarned} pts` : (pointsEarned === 0 ? '0 pts' : 'Pending');
      
      currentPickHtml = `
        <div class="current-pick-info">
          <img src="${player.current_pick.flag || ''}" alt="" class="pick-flag-small">
          <span class="pick-team">${player.current_pick.team}</span>
          <span class="pick-points ${pointsClass}">${pointsText}</span>
        </div>
      `;
    }
    
    // Picks grouped by round for mobile view
    let picksByRoundHtml = '';
    if (player.picks_by_round && Object.keys(player.picks_by_round).length > 0) {
      const roundOrder = ['GS', 'L32', 'L16', 'QF', 'SF', 'F'];
      picksByRoundHtml = `
        <div class="player-picks-by-round">
          ${roundOrder.filter(r => player.picks_by_round[r]).map(round => `
            <div class="pick-round-line">
              <span class="round-label">${round}:</span>
              <span class="round-flags">
                ${player.picks_by_round[round].map(p => `
                  <img src="${p.flag || ''}" alt="${p.team}" class="pick-flag-tiny" title="${p.team}">
                `).join('')}
              </span>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    html += `
      <div class="leaderboard-row ${isEliminated ? 'eliminated' : ''} ${position <= 3 ? 'top-three' : ''}">
        <div class="col-rank">${rankDisplay}</div>
        <div class="col-player">
          <div class="player-info">
            <strong>${player.display_name || player.username}</strong>
            <span class="username">@${player.username}</span>
            ${picksByRoundHtml}
          </div>
        </div>
        <div class="col-points">
          <span class="points-badge">${totalPoints}</span>
        </div>
        <div class="col-wins">
          <span class="wins-badge">${wins}</span>
        </div>
        <div class="col-pick">${currentPickHtml}</div>
        <div class="col-status">
          ${isEliminated ? 
            '<span class="status-badge eliminated"><i class="fas fa-times-circle"></i> Out</span>' :
            '<span class="status-badge active"><i class="fas fa-check-circle"></i> In</span>'
          }
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Load on page load
document.addEventListener('DOMContentLoaded', loadLeaderboard);
