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
          
          html += `
            <div class="match-entry-row ${isFinished ? 'finished' : ''}" data-match-id="${match.id}">
              <div class="match-admin-when">${dateStr} @ ${timeStr}</div>
              
              <div class="match-admin-cards">
                <!-- Team A Card -->
                <div class="admin-team-card">
                  <div class="admin-team-header">
                    <img src="${match.home_team?.flag_url}" alt="" class="admin-card-flag">
                    <span class="admin-card-name">${match.home_team?.name}</span>
                  </div>
                  ${!isFinished ? 
                    `<input type="number" id="score-${match.id}-home" min="0" placeholder="0" class="admin-card-input">` :
                    `<div class="admin-card-result">${match.home_score}</div>`
                  }
                </div>
                
                <!-- VS & Save Card -->
                <div class="admin-vs-card">
                  <span class="admin-vs-text">v</span>
                  ${!isFinished ? `<button class="btn admin-save-btn" onclick="submitResult('${match.id}')">Save</button>` : '<span class="admin-finished-text">FT</span>'}
                </div>
                
                <!-- Team B Card -->
                <div class="admin-team-card">
                  <div class="admin-team-header">
                    <img src="${match.away_team?.flag_url}" alt="" class="admin-card-flag">
                    <span class="admin-card-name">${match.away_team?.name}</span>
                  </div>
                  ${!isFinished ? 
                    `<input type="number" id="score-${match.id}-away" min="0" placeholder="0" class="admin-card-input">` :
                    `<div class="admin-card-result">${match.away_score}</div>`
                  }
                </div>
              </div>
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
        <p>Teams found: ${data.teamsFound}</p>
        <p>Matches imported: ${data.matchesInserted}</p>
        ${data.missingTeams ? `<p>Missing teams: ${data.missingTeams.join(', ')}</p>` : ''}
      `;
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

async function openRound() {
  const roundId = prompt('Enter Round ID to open:');
  if (!roundId) return;
  const res = await fetch('/api/rounds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'open', round_id: roundId })
  });
  const data = await res.json();
  alert(res.ok ? 'Round opened!' : `Error: ${data.error}`);
  loadAdminData();
}

async function closeRound() {
  const roundId = prompt('Enter Round ID to close:');
  if (!roundId) return;
  const res = await fetch('/api/rounds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'close', round_id: roundId })
  });
  const data = await res.json();
  alert(res.ok ? 'Round closed!' : `Error: ${data.error}`);
  loadAdminData();
}

async function resetAllData() {
  const confirm1 = confirm(
    '⚠️ WARNING — This will delete EVERYTHING:\n\n' +
    '• All picks\n' +
    '• All tournament entries\n' +
    '• All matches\n' +
    '• All rounds\n' +
    '• All tournaments\n' +
    '• All teams\n' +
    '• All user profiles\n' +
    '• All auth accounts (users must re-register)\n\n' +
    'Only master_teams (flag images) is preserved.\n\n' +
    'Are you sure?'
  );
  if (!confirm1) return;

  const confirm2 = prompt('Type RESET to confirm:');
  if (confirm2 !== 'RESET') {
    alert('Cancelled.');
    return;
  }

  const statusDiv = document.getElementById('reset-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Resetting all data...</p>';

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', confirm: 'RESET', admin_pin: '1234' })
    });

    const data = await response.json();

    if (response.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);">
          <i class="fas fa-check-circle"></i> Reset complete!
        </p>
        <p>${data.message}</p>
        <p><strong>Next:</strong> Click Setup Tournament above.</p>
      `;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

async function setupTournament() {
  const confirmed = confirm(
    'Setup the World Cup 2026 Last Man Standing tournament?\n\n' +
    '£30 entry | 100 players max | 3 lives\n\n' +
    'This will create the tournament, copy all 48 teams,\n' +
    'create 6 rounds and import the match schedule.\n\n' +
    'Make sure you have run Reset All Data first.'
  );
  if (!confirmed) return;

  const statusDiv = document.getElementById('setup-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Setting up tournament... (may take a few seconds)</p>';

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setup', admin_pin: '1234' })
    });

    const data = await response.json();

    if (response.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);">
          <i class="fas fa-check-circle"></i> Tournament ready!
        </p>
        <p>Teams added: ${data.teamsAdded}</p>
        <p>Matches imported: ${data.matchesImported}</p>
        ${data.missingTeams ? `<p style="color: orange;">⚠️ Missing teams (name mismatch): ${data.missingTeams.join(', ')}</p>` : ''}
        <p>${data.message}</p>
        <p><strong>Site is live — users can now register and enter the tournament.</strong></p>
      `;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

async function simulateUsers() {
  const confirmed = confirm('Register 5 test users and enter them into the tournament?');
  if (!confirmed) return;

  const statusDiv = document.getElementById('simulate-users-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Registering users...</p>';

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'simulate_users', admin_pin: '1234' })
    });

    const data = await response.json();

    if (response.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>
      `;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

async function simulatePicks(matchday) {
  const confirmed = confirm(`Make Matchday ${matchday} picks for all users?`);
  if (!confirmed) return;

  const statusDiv = document.getElementById('simulate-picks-status');
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Making Matchday ${matchday} picks...</p>`;

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'simulate_picks', matchday, admin_pin: '1234' })
    });

    const data = await response.json();

    if (response.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>
      `;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

async function simulateResults(matchday) {
  const confirmed = confirm(`Simulate random results for all Matchday ${matchday} matches?\n\nThis will update match scores and process eliminations.`);
  if (!confirmed) return;

  const statusDiv = document.getElementById('simulate-results-status');
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Simulating Matchday ${matchday} results...</p>`;

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'simulate_results', matchday, admin_pin: '1234' })
    });

    const data = await response.json();

    if (response.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>
        ${data.eliminations > 0 ? `<p style="color: orange;">⚠️ ${data.eliminations} users eliminated!</p>` : ''}
      `;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}
