// Admin panel JavaScript - v4

const ADMIN_PIN = '1234';

document.addEventListener('DOMContentLoaded', function() {
  checkAdminAccess();
});

async function checkAdminAccess() {
  const token = localStorage.getItem('wc_lms_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }
  
  const pinVerified = sessionStorage.getItem('admin_pin_verified');
  if (pinVerified === 'true') {
    loadAdminData();
    return;
  }
  
  showPinModal();
}

function showPinModal() {
  const pin = prompt('Enter admin PIN:');
  if (pin === ADMIN_PIN) {
    sessionStorage.setItem('admin_pin_verified', 'true');
    loadAdminData();
  } else {
    alert('Incorrect PIN');
    window.location.href = '/index.html';
  }
}

async function loadAdminData() {
  console.log('Admin panel loaded');
  await loadRoundStatus();
  await loadMatchesForResults();
  await loadAllPicks();
}

async function loadRoundStatus() {
  const container = document.getElementById('round-status');
  
  try {
    const response = await fetch('/api/rounds');
    const data = await response.json();
    
    if (!response.ok) {
      container.innerHTML = `<p class="error">Error: ${data.error}</p>`;
      return;
    }
    
    let html = '<div class="rounds-list">';
    data.rounds?.forEach(round => {
      const statusClass = round.status === 'open' ? 'status-open' : 
                         round.status === 'closed' ? 'status-closed' : 'status-upcoming';
      html += `
        <div class="round-item">
          <span class="round-name">${round.name}</span>
          <span class="round-status ${statusClass}">${round.status}</span>
        </div>
      `;
    });
    html += '</div>';
    
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<p class="error">Error loading rounds</p>`;
  }
}

async function loadMatchesForResults() {
  const container = document.getElementById('match-list');
  const resultContainer = document.getElementById('result-entry');
  
  try {
    const response = await fetch('/api/matches?limit=100');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error);
    }
    
    const matches = data.matches || [];
    
    if (matches.length === 0) {
      resultContainer.innerHTML = '<p class="text-secondary">No matches found.</p>';
    } else {
      // Group by matchday
      const byMatchday = { 1: [], 2: [], 3: [] };
      matches.forEach(m => {
        if (m.matchday && byMatchday[m.matchday]) {
          byMatchday[m.matchday].push(m);
        }
      });
      
      let html = '<div class="matches-for-entry">';
      
      // Add filter input
      html += `
        <div class="match-filter">
          <input type="text" id="match-filter-input" placeholder="Filter by team name..." onkeyup="filterMatches()">
          <button class="btn btn-secondary btn-sm" onclick="clearFilter()">Clear</button>
        </div>
      `;
      
      [1, 2, 3].forEach(md => {
        const mdMatches = byMatchday[md];
        if (mdMatches.length === 0) return;
        
        html += `<h4 class="matchday-header-admin">Matchday ${md}</h4>`;
        
        mdMatches.forEach(match => {
          const matchDate = new Date(match.match_time);
          const dateStr = matchDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          const timeStr = matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          const isFinished = match.status === 'finished';
          const groupName = match.home_team?.group_name || match.away_team?.group_name || '?';
          
          html += `
            <div class="match-entry-row ${isFinished ? 'finished' : ''}" data-match-id="${match.id}">
              <div class="match-admin-top">
                <span class="match-admin-datetime">${dateStr} @ ${timeStr}</span>
                <span class="match-admin-group">Group ${groupName}</span>
              </div>
              <div class="match-admin-teams-row">
                <div class="match-admin-team-info">
                  <img src="${match.home_team?.flag_url}" alt="" class="match-admin-flag">
                  <span class="match-admin-teamname">${match.home_team?.name}</span>
                </div>
                <span class="match-admin-vs">VS</span>
                <div class="match-admin-team-info">
                  <img src="${match.away_team?.flag_url}" alt="" class="match-admin-flag">
                  <span class="match-admin-teamname">${match.away_team?.name}</span>
                </div>
              </div>
              ${!isFinished ? `
                <div class="match-admin-scores">
                  <input type="number" id="score-${match.id}-home" min="0" placeholder="0" class="score-input">
                  <button class="btn btn-primary btn-sm" onclick="submitResult('${match.id}')">Save</button>
                  <input type="number" id="score-${match.id}-away" min="0" placeholder="0" class="score-input">
                </div>
              ` : `
                <div class="match-admin-final-score">
                  <span class="final-score-box">${match.home_score}</span>
                  <span class="final-score-separator">-</span>
                  <span class="final-score-box">${match.away_score}</span>
                </div>
              `}
            </div>
          `;
        });
      });
      
      html += '</div>';
      resultContainer.innerHTML = html;
    }
    
    // Summary
    const allResponse = await fetch('/api/matches?limit=100');
    const allData = await allResponse.json();
    const allMatches = allData.matches || [];
    
    const upcomingCount = allMatches.filter(m => m.status === 'upcoming').length;
    const finishedCount = allMatches.filter(m => m.status === 'finished').length;
    
    container.innerHTML = `
      <p><strong>Upcoming:</strong> ${upcomingCount} matches</p>
      <p><strong>Finished:</strong> ${finishedCount} matches</p>
    `;
    
  } catch (error) {
    console.error('Error loading matches:', error);
    container.innerHTML = `<p class="error">Error loading matches</p>`;
    resultContainer.innerHTML = `<p class="error">Error loading matches for entry</p>`;
  }
}

async function submitResult(matchId) {
  const homeScore = document.getElementById(`score-${matchId}-home`).value;
  const awayScore = document.getElementById(`score-${matchId}-away`).value;
  
  if (homeScore === '' || awayScore === '') {
    alert('Please enter both scores');
    return;
  }
  
  try {
    const response = await fetch('/api/admin-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: matchId,
        home_score: parseInt(homeScore),
        away_score: parseInt(awayScore)
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert(`Result saved!\n${data.match.home} ${data.match.score} ${data.match.away}\n${data.match.result}`);
      loadAdminData();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (error) {
    alert('Error saving result: ' + error.message);
  }
}

async function loadAllPicks() {
  const container = document.getElementById('all-picks');
  
  try {
    const response = await fetch('/api/picks?admin=true');
    const data = await response.json();
    
    if (!response.ok) {
      container.innerHTML = `<p class="error">Error: ${data.error}</p>`;
      return;
    }
    
    if (!data.picks || data.picks.length === 0) {
      container.innerHTML = '<p class="text-secondary">No picks yet. Players haven\'t made any selections.</p>';
      return;
    }
    
    let html = `
      <div class="picks-summary">
        <span class="pick-stat">Total: ${data.totalPicks}</span>
        <span class="pick-stat pending">Pending: ${data.stats.pending}</span>
        <span class="pick-stat win">Wins: ${data.stats.win}</span>
        <span class="pick-stat loss">Losses: ${data.stats.loss}</span>
      </div>
      <div class="picks-list">
    `;
    
    data.picks.forEach(pick => {
      const statusClass = pick.result === 'pending' ? 'status-pending' :
                         pick.result === 'win' ? 'status-win' : 'status-loss';
      html += `
        <div class="pick-item">
          <div class="pick-user">
            <strong>${pick.users?.display_name || pick.users?.username || 'Unknown'}</strong>
            <span class="pick-round">${pick.rounds?.name || 'Unknown Round'}</span>
          </div>
          <div class="pick-team">
            <img src="${pick.teams?.flag_url}" alt="" class="pick-flag">
            <span>${pick.teams?.name}</span>
            <span class="pick-group">Group ${pick.teams?.group_name}</span>
          </div>
          <span class="pick-result ${statusClass}">${pick.result}</span>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
  } catch (error) {
    container.innerHTML = `<p class="error">Error loading picks: ${error.message}</p>`;
  }
}

async function updateResultsFromFixturedownload() {
  const statusDiv = document.getElementById('update-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Fetching results from fixturedownload...</p>';
  
  try {
    const token = localStorage.getItem('wc_lms_token');
    const response = await fetch('/api/update-results', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);">
          <i class="fas fa-check-circle"></i> Results updated!
        </p>
        <p>Matches updated: ${data.matchesUpdated || 0}</p>
        <p>Picks processed: ${data.picksProcessed || 0}</p>
        <p>Lives deducted: ${data.livesDeducted || 0}</p>
        <p>Players eliminated: ${data.playersEliminated || 0}</p>
      `;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

function filterMatches() {
  const filterText = document.getElementById('match-filter-input').value.toLowerCase();
  const rows = document.querySelectorAll('.match-entry-row');
  
  rows.forEach(row => {
    const teamNames = row.textContent.toLowerCase();
    if (teamNames.includes(filterText)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
  
  // Also hide/show matchday headers based on visible matches
  const headers = document.querySelectorAll('.matchday-header-admin');
  headers.forEach(header => {
    let nextEl = header.nextElementSibling;
    let hasVisible = false;
    while (nextEl && !nextEl.classList.contains('matchday-header-admin')) {
      if (nextEl.classList.contains('match-entry-row') && nextEl.style.display !== 'none') {
        hasVisible = true;
        break;
      }
      nextEl = nextEl.nextElementSibling;
    }
    header.style.display = hasVisible ? '' : 'none';
  });
}

function clearFilter() {
  document.getElementById('match-filter-input').value = '';
  filterMatches();
}

async function importWorldCupData() {
  const statusDiv = document.getElementById('import-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Importing...</p>';
  
  try {
    const token = localStorage.getItem('wc_lms_token');
    const response = await fetch('/api/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action: 'setup' })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);">
          <i class="fas fa-check-circle"></i> Import successful!
        </p>
        <p>Rounds: ${data.roundsCreated}</p>
      `;
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

async function openRound() {
  alert('Round opening - implement via API');
}

async function closeRound() {
  alert('Round closing - implement via API');
}
