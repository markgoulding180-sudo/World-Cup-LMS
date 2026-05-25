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
    <div style="display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: nowrap;">
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 1.25rem 1.5rem; background: rgba(26, 31, 77, 0.5); border: 1px solid #2a3066; border-radius: 0.75rem; flex: 0 1 140px; min-width: 100px;">
        <div style="font-size: 1.75rem; font-weight: 700; color: #ffd700;">${stats?.total_players || 0}</div>
        <div style="font-size: 0.875rem; color: #8b92b9; margin-top: 0.25rem;">Players</div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 1.25rem 1.5rem; background: rgba(26, 31, 77, 0.5); border: 1px solid #2a3066; border-radius: 0.75rem; flex: 0 1 140px; min-width: 100px;">
        <div style="font-size: 1.75rem; font-weight: 700; color: #ffd700;">${stats?.active_players || 0}</div>
        <div style="font-size: 0.875rem; color: #8b92b9; margin-top: 0.25rem;">Active</div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 1.25rem 1.5rem; background: rgba(26, 31, 77, 0.5); border: 1px solid #2a3066; border-radius: 0.75rem; flex: 0 1 140px; min-width: 100px;">
        <div style="font-size: 1.75rem; font-weight: 700; color: #ffd700;">${stats?.eliminated_players || 0}</div>
        <div style="font-size: 0.875rem; color: #8b92b9; margin-top: 0.25rem;">Eliminated</div>
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
    
    html += `
      <div class="leaderboard-row ${isEliminated ? 'eliminated' : ''} ${position <= 3 ? 'top-three' : ''}">
        <div class="mobile-row-1">
          <span class="col-rank">${rankDisplay}</span>
          <span class="col-player">
            <a href="player.html?user=${encodeURIComponent(player.username)}" class="player-name-link">
              <strong class="${isEliminated ? 'eliminated-name' : ''}">${player.display_name || player.username}</strong>
            </a>
            <span class="click-to-see-picks">(click to see picks)</span>
          </span>
          <span class="col-points"><span class="points-badge">${totalPoints}</span></span>
          <span class="col-wins"><span class="wins-badge">${wins}</span></span>
        </div>
        <div class="col-status desktop-only">
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
