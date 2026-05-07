// Admin panel JavaScript

// Admin PIN
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
  // Simple PIN prompt for now
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
    // Get upcoming matches
    const response = await fetch('/api/matches?status=upcoming&limit=20');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error);
    }
    
    const matches = data.matches || [];
    
    if (matches.length === 0) {
      resultContainer.innerHTML = '<p class="text-secondary">No upcoming matches to enter results for.</p>';
    } else {
      let html = '<div class="matches-for-entry">';
      matches.forEach(match => {
        html += `
          <div class="match-entry-row">
            <div class="match-teams">
              <div class="team">
                <img src="${match.home_team?.flag_url}" alt="" class="team-flag-small">
                <span>${match.home_team?.name}</span>
              </div>
              <span class="vs">vs</span>
              <div class="team">
                <img src="${match.away_team?.flag_url}" alt="" class="team-flag-small">
                <span>${match.away_team?.name}</span>
              </div>
            </div>
            <div class="score-inputs">
              <input type="number" id="score-${match.id}-home" min="0" placeholder="0" class="score-input">
              <span>-</span>
              <input type="number" id="score-${match.id}-away" min="0" placeholder="0" class="score-input">
              <button class="btn btn-primary btn-sm" onclick="submitResult('${match.id}')">Save</button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      resultContainer.innerHTML = html;
    }
    
    // Get all matches for summary
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
    
    // Display upcoming matches for result entry
    const upcomingMatches = matches?.filter(m => m.status === 'upcoming') || [];
    
    if (upcomingMatches.length === 0) {
      resultContainer.innerHTML = '<p class="text-secondary">No upcoming matches to enter results for.</p>';
    } else {
      let html = '<div class="matches-for-entry">';
      upcomingMatches.forEach(match => {
        html += `
          <div class="match-entry-row">
            <div class="match-teams">
              <div class="team">
                <img src="${match.home_team?.flag_url}" alt="" class="team-flag-small">
                <span>${match.home_team?.name}</span>
              </div>
              <span class="vs">vs</span>
              <div class="team">
                <img src="${match.away_team?.flag_url}" alt="" class="team-flag-small">
                <span>${match.away_team?.name}</span>
              </div>
            </div>
            <div class="score-inputs">
              <input type="number" id="score-${match.id}-home" min="0" placeholder="0" class="score-input">
              <span>-</span>
              <input type="number" id="score-${match.id}-away" min="0" placeholder="0" class="score-input">
              <button class="btn btn-primary btn-sm" onclick="submitResult('${match.id}')">Save</button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      resultContainer.innerHTML = html;
    }
    
    // Display match list summary
    const finishedMatches = matches?.filter(m => m.status === 'finished') || [];
    container.innerHTML = `
      <p><strong>Upcoming:</strong> ${upcomingMatches.length} matches</p>
      <p><strong>Finished:</strong> ${finishedMatches.length} matches</p>
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
      loadAdminData(); // Refresh all data
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
    console.log('Import response:', data);
    
    if (response.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);">
          <i class="fas fa-check-circle"></i> 
          Import successful!
        </p>
        <p>Teams: ${data.teams}</p>
        <p>Rounds: ${data.rounds}</p>
        <p>Tournament: ${data.tournament?.name}</p>
      `;
    } else {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-red);">Error: ${data.error}</p>
        <pre style="font-size: 0.75rem; color: var(--text-secondary); overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>
      `;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

async function openRound() {
  const token = localStorage.getItem('wc_lms_token');
  
  try {
    const response = await fetch('/api/rounds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action: 'open' })
    });
    
    if (response.ok) {
      alert('Round opened!');
    }
  } catch (error) {
    alert('Error opening round');
  }
}

async function closeRound() {
  const token = localStorage.getItem('wc_lms_token');
  
  try {
    const response = await fetch('/api/rounds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action: 'close' })
    });
    
    if (response.ok) {
      alert('Round closed!');
    }
  } catch (error) {
    alert('Error closing round');
  }
}
