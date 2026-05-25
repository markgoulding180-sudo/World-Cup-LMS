// Player Profile Page JavaScript

const API_BASE = '/api';

// Get username from URL query parameter
function getUsernameFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('user');
}

async function loadPlayerProfile() {
  const username = getUsernameFromUrl();
  const container = document.getElementById('player-profile');
  
  if (!username) {
    container.innerHTML = '<div class="error">No player specified</div>';
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/leaderboard`);
    const data = await response.json();
    
    if (!response.ok) {
      container.innerHTML = '<div class="error">Error loading profile</div>';
      return;
    }
    
    // Find player in leaderboard
    const player = data.leaderboard?.find(p => 
      p.username === username || p.display_name === username
    );
    
    if (!player) {
      container.innerHTML = '<div class="error">Player not found</div>';
      return;
    }
    
    displayPlayerProfile(player, data.stats);
    
  } catch (error) {
    console.error('Error loading player profile:', error);
    container.innerHTML = '<div class="error">Error loading profile</div>';
  }
}

function displayPlayerProfile(player, stats) {
  const container = document.getElementById('player-profile');
  
  const roundNames = { 'GS': 'Group Stage', 'L32': 'Round of 32', 'L16': 'Round of 16', 'QF': 'Quarter Finals', 'SF': 'Semi Finals', 'F': 'Final' };
  const roundOrder = ['GS', 'L32', 'L16', 'QF', 'SF', 'F'];
  
  // Build picks by round HTML
  let picksHtml = '';
  roundOrder.forEach(round => {
    const picks = player.picks_by_round?.[round];
    if (picks && picks.length > 0) {
      // Group Stage gets special grid class
      const picksClass = round === 'GS' ? 'profile-picks group-stage-grid' : 'profile-picks';
      picksHtml += `
        <div class="profile-round">
          <h4>${roundNames[round]}</h4>
          <div class="${picksClass}">
            ${picks.map(p => `
              <div class="profile-pick ${p.result}">
                <img src="${p.flag || ''}" alt="${p.team}" class="profile-pick-flag">
                <span class="profile-pick-team">${p.team}</span>
                <span class="profile-pick-result">${p.result === 'win' ? '✓' : p.result === 'loss' ? '✗' : '⏳'}</span>
                ${p.points > 0 ? `<span class="profile-pick-points">+${p.points}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  });
  
  if (!picksHtml) {
    picksHtml = '<p class="text-secondary">No picks made yet</p>';
  }
  
  container.innerHTML = `
    <div class="profile-card">
      <div class="profile-header">
        <div class="profile-rank">#${player.position}</div>
        <div class="profile-info">
          <h1>${player.display_name || player.username}</h1>
          <p class="profile-username">@${player.username}</p>
          <span class="status-badge ${player.status === 'eliminated' ? 'eliminated' : 'active'}">
            ${player.status === 'eliminated' ? '<i class="fas fa-times-circle"></i> Out' : '<i class="fas fa-check-circle"></i> In'}
          </span>
        </div>
      </div>
      
      <div class="profile-stats">
        <div class="profile-stat">
          <span class="profile-stat-value">${player.total_points}</span>
          <span class="profile-stat-label">Total Points</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-value">${player.wins}</span>
          <span class="profile-stat-label">Correct Picks</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-value">${stats?.total_players ? Math.round((player.position / stats.total_players) * 100) : '--'}%</span>
          <span class="profile-stat-label">Percentile</span>
        </div>
      </div>
      
      <div class="profile-picks-section">
        <h3>Tournament Picks</h3>
        ${picksHtml}
      </div>
      
      <div class="profile-actions">
        <a href="leaderboard.html" class="btn btn-secondary">
          <i class="fas fa-arrow-left"></i> Back to Leaderboard
        </a>
      </div>
    </div>
  `;
}

// Load on page load
document.addEventListener('DOMContentLoaded', loadPlayerProfile);
