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
    
    // Picks grouped by round (small flags)
    let picksByRoundHtml = '';
    if (player.picks_by_round && Object.keys(player.picks_by_round).length > 0) {
      const roundOrder = ['GS', 'L32', 'L16', 'QF', 'SF', 'F'];
      
      // Group Stage on its own line
      const gsPicks = player.picks_by_round['GS'];
      const gsHtml = gsPicks ? `
        <div class="pick-round-line">
          <span class="round-label">GS:</span>
          <span class="round-flags">
            ${gsPicks.map(p => `
              <img src="${p.flag || ''}" alt="${p.team}" class="pick-flag-tiny" title="${p.team}" style="width:16px;height:11px;min-width:16px;min-height:11px;object-fit:cover;">
            `).join('')}
          </span>
        </div>
      ` : '';
      
      // All KO rounds on one line with labels before each flag
      const koRounds = ['L32', 'L16', 'QF', 'SF', 'F'];
      let koHtml = '';
      
      koRounds.forEach(round => {
        if (player.picks_by_round[round]) {
          player.picks_by_round[round].forEach(p => {
            koHtml += `
              <span class="ko-pick">
                <span class="round-label-mini">${round}</span>
                <img src="${p.flag || ''}" alt="${p.team}" class="pick-flag-tiny" title="${p.team}" style="width:16px;height:11px;min-width:16px;min-height:11px;object-fit:cover;">
              </span>
            `;
          });
        }
      });
      
      koHtml = koHtml ? `
        <div class="pick-round-line ko-line">
          <span class="round-flags ko-flags">
            ${koHtml}
          </span>
        </div>
      ` : '';
      
      picksByRoundHtml = `
        <div class="player-picks-by-round">
          ${gsHtml}
          ${koHtml}
        </div>
      `;
    }
    
    html += `
      <div class="leaderboard-row ${isEliminated ? 'eliminated' : ''} ${position <= 3 ? 'top-three' : ''}">
        <div class="mobile-row-1">
          <span class="col-rank">${rankDisplay}</span>
          <span class="col-player">
            <a href="player.html?user=${encodeURIComponent(player.username)}" class="player-name-link">
              <strong class="${isEliminated ? 'eliminated-name' : ''}">${player.display_name || player.username}</strong>
            </a>
          </span>
          <span class="col-points"><span class="points-badge">${totalPoints}</span></span>
          <span class="col-wins"><span class="wins-badge">${wins}</span></span>
        </div>
        <div class="mobile-row-2">
          ${picksByRoundHtml}
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
