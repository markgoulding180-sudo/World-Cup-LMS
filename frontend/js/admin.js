// Admin panel JavaScript - v5

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
    const response = await fetch('/api/matches?limit=200');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    const matches = data.matches || [];

    if (matches.length === 0) {
      resultContainer.innerHTML = '<p class="text-secondary">No matches found.</p>';
    } else {
      // Group by matchday for group stage, then by round for KO
      const byMatchday = { 1: [], 2: [], 3: [] };
      const koMatches = [];

      matches.forEach(m => {
        if (m.matchday && byMatchday[m.matchday]) {
          byMatchday[m.matchday].push(m);
        } else {
          koMatches.push(m);
        }
      });

      let html = '<div class="matches-for-entry">';

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
          html += buildMatchRow(match);
        });
      });

      if (koMatches.length > 0) {
        html += `<h4 class="matchday-header-admin">Knockout Stage</h4>`;
        koMatches.forEach(match => {
          html += buildMatchRow(match);
        });
      }

      html += '</div>';
      resultContainer.innerHTML = html;
    }

    const upcomingCount = matches.filter(m => m.status === 'upcoming').length;
    const finishedCount = matches.filter(m => m.status === 'finished').length;

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

function buildMatchRow(match) {
  const matchDate = new Date(match.match_time);
  const dateStr = matchDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const timeStr = matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const isFinished = match.status === 'finished';

  return `
    <div class="match-entry-row ${isFinished ? 'finished' : ''}" data-match-id="${match.id}">
      <div class="match-admin-when">${dateStr} @ ${timeStr}</div>
      <div class="match-admin-cards">
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
        <div class="admin-vs-card">
          <span class="admin-vs-text">v</span>
          ${!isFinished ? `<button class="btn admin-save-btn" onclick="submitResult('${match.id}')">Save</button>` : '<span class="admin-finished-text">FT</span>'}
        </div>
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
      container.innerHTML = '<p class="text-secondary">No picks yet.</p>';
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
    row.style.display = teamNames.includes(filterText) ? '' : 'none';
  });

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
        ${data.missingTeams ? `<p style="color: orange;">Missing teams: ${data.missingTeams.join(', ')}</p>` : ''}
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

// ─── RESET ALL DATA ───────────────────────────────────────
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

// ─── SETUP TOURNAMENT ─────────────────────────────────────
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
        ${data.missingTeams ? `<p style="color: orange;">⚠️ Missing teams: ${data.missingTeams.join(', ')}</p>` : ''}
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

// ─── SET LIVES ────────────────────────────────────────────
async function setLives() {
  const lives = parseInt(document.getElementById('lives-select').value);

  const confirmed = confirm(`Set lives to ${lives} for all active players?\n\nThis updates the tournament setting and all active tournament entries.`);
  if (!confirmed) return;

  const statusDiv = document.getElementById('lives-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Updating lives...</p>';

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_lives', lives, admin_pin: '1234' })
    });

    const data = await response.json();

    if (response.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);">
          <i class="fas fa-check-circle"></i> ${data.message}
        </p>
      `;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

// ─── FULL AUTO SIMULATION ─────────────────────────────────
async function runFullSimulation() {
  const userCount = parseInt(document.getElementById('sim-user-count').value) || 50;

  const confirmed = confirm(
    `Run FULL tournament simulation with ${userCount} users?\n\n` +
    'This will:\n' +
    '• Register users and enter them into the tournament\n' +
    '• Simulate all 3 Group Stage matchdays (picks + results)\n' +
    '• Qualify 32 teams (top 2 per group + best 8 third-placed)\n' +
    '• Create and simulate all KO rounds through to the Final\n' +
    '• Return a full elimination summary\n\n' +
    'Runs in two steps to avoid timeout. Do not close this page.'
  );
  if (!confirmed) return;

  const statusDiv = document.getElementById('full-sim-status');

  try {
    // ── Step 1: Register users in batches ──
    const batchSize = 10;
    const batches = Math.ceil(userCount / batchSize);
    let totalRegistered = 0;

    for (let b = 0; b < batches; b++) {
      const start = b * batchSize + 1;
      const end = Math.min((b + 1) * batchSize, userCount);
      statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Registering users ${start}-${end} of ${userCount}...</p>`;

      const regResponse = await fetch('/api/reset-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate_users', batch: b, admin_pin: '1234' })
      });

      const regData = await regResponse.json();
      if (!regResponse.ok) {
        statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error registering users: ${regData.error}</p>`;
        return;
      }
      totalRegistered += regData.registered || 0;
    }

    // ── Step 2: Run the full simulation (no user registration) ──
    statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> ${totalRegistered} users registered. Running full tournament simulation... (30-60 seconds)</p>`;

    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'simulate_full', user_count: 0, admin_pin: '1234' })
    });

    const data = await response.json();

    if (response.ok && data.summary) {
      const s = data.summary;

      const stagesHtml = s.survivorsPerStage.map(stage => `
        <tr>
          <td style="padding: 0.4rem 0.8rem;">${stage.stage}</td>
          <td style="padding: 0.4rem 0.8rem; text-align: center; color: var(--accent-green);">${stage.survivors}</td>
          <td style="padding: 0.4rem 0.8rem; text-align: center; color: ${stage.eliminated > 0 ? 'orange' : 'inherit'};">${stage.eliminated || 0}</td>
        </tr>
      `).join('');

      statusDiv.innerHTML = `
        <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: 0.5rem; border: 1px solid #9333ea;">
          <h3 style="color: gold; margin-bottom: 1rem;">🏆 Simulation Complete!</h3>
          <p><strong>Users registered:</strong> ${totalRegistered}</p>
          <p><strong>Starting lives:</strong> ${s.startLives}</p>
          <p><strong>Teams in Round of 32:</strong> ${s.teamsQualifiedForR32 || 32}</p>
          <p style="color: gold; font-size: 1.1rem; margin: 0.5rem 0;"><strong>🥇 Winner: ${s.winner}</strong></p>
          <p><strong>Final survivors:</strong> ${s.finalSurvivors}</p>

          <h4 style="margin: 1rem 0 0.5rem;">Elimination Timeline</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color);">
                <th style="padding: 0.4rem 0.8rem; text-align: left;">Stage</th>
                <th style="padding: 0.4rem 0.8rem;">Survivors</th>
                <th style="padding: 0.4rem 0.8rem;">Eliminated</th>
              </tr>
            </thead>
            <tbody>${stagesHtml}</tbody>
          </table>
        </div>
      `;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data?.error || 'Simulation timed out. Try with fewer users.'}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

// ─── STEP BY STEP SIMULATION ──────────────────────────────
let currentUserBatch = 0;

async function simulateUsersBatch() {
  const statusDiv = document.getElementById('simulate-users-status');

  if (currentUserBatch >= 5) {
    statusDiv.innerHTML = '<p style="color: var(--accent-green);">✅ All 50 users registered!</p>';
    return;
  }

  const batchNum = currentUserBatch + 1;
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Registering batch ${batchNum} of 5 (10 users)...</p>`;

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'simulate_users', batch: currentUserBatch, admin_pin: '1234' })
    });

    const data = await response.json();

    if (response.ok) {
      currentUserBatch++;
      const remaining = 50 - (currentUserBatch * 10);
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> Batch ${batchNum} done! ${data.registered} users added.</p>
        <p>Total: ${currentUserBatch * 10} users. ${remaining > 0 ? remaining + ' more to go.' : 'All done!'}</p>
        ${remaining > 0 ? `<button class="btn btn-secondary" onclick="simulateUsersBatch()">Add Next 10 Users</button>` : ''}
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
  const confirmed = confirm(`Make Matchday ${matchday} picks for all active users?`);
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
      statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>`;
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

async function createKnockoutMatches() {
  const confirmed = confirm(
    'Create Round of 32 matches from group stage results?\n\n' +
    '2026 World Cup format:\n' +
    '• Top 2 from each of 12 groups = 24 teams\n' +
    '• Best 8 third-placed teams = 8 more teams\n' +
    '• Total = 32 teams → 16 matches\n\n' +
    'Make sure all 3 matchdays have been simulated first.'
  );
  if (!confirmed) return;

  const statusDiv = document.getElementById('create-knockout-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Calculating group standings and creating 16 matches...</p>';

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_knockout_matches', admin_pin: '1234' })
    });

    const data = await response.json();

    if (response.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>
        <p>Teams qualified: ${data.teamsQualified} | Matches created: ${data.matchesCreated}</p>
        <p><strong>Next:</strong> Go to Step 5 → Round of 32 → Make Picks</p>
      `;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

async function createNextRoundMatches(fromRoundNumber) {
  const roundNames = { 2: 'Round of 16', 3: 'Quarter Finals', 4: 'Semi Finals', 5: 'Final' };
  const nextRoundName = roundNames[fromRoundNumber];

  const confirmed = confirm(`Create ${nextRoundName} matches from the winners of Round ${fromRoundNumber}?\n\nMake sure results have been simulated for the current round first.`);
  if (!confirmed) return;

  const statusDiv = document.getElementById('simulate-knockout-status');
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Creating ${nextRoundName} matches...</p>`;

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_next_round_matches', from_round_number: fromRoundNumber, admin_pin: '1234' })
    });

    const data = await response.json();

    if (response.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);">
          <i class="fas fa-check-circle"></i> ${data.message}
        </p>
        <p>Matches created: ${data.matchesCreated}</p>
        <p><strong>Next:</strong> Click "Make Picks" for ${nextRoundName}.</p>
      `;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

async function simulateKnockoutPicks(roundNumber) {
  const roundNames = { 2: 'Round of 32', 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
  const confirmed = confirm(`Make picks for ${roundNames[roundNumber]}?`);
  if (!confirmed) return;

  const statusDiv = document.getElementById('simulate-knockout-status');
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Making ${roundNames[roundNumber]} picks...</p>`;

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'simulate_knockout_picks', round_number: roundNumber, admin_pin: '1234' })
    });

    const data = await response.json();

    if (response.ok) {
      statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>`;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

async function simulateKnockoutResults(roundNumber) {
  const roundNames = { 2: 'Round of 32', 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
  const confirmed = confirm(`Simulate results for ${roundNames[roundNumber]}?\n\nNo draws in knockout — a winner will be forced for every match.`);
  if (!confirmed) return;

  const statusDiv = document.getElementById('simulate-knockout-status');
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Simulating ${roundNames[roundNumber]} results...</p>`;

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'simulate_knockout_results', round_number: roundNumber, admin_pin: '1234' })
    });

    const data = await response.json();

    if (response.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>
        ${data.eliminations > 0 ? `<p style="color: orange;">⚠️ ${data.eliminations} users eliminated!</p>` : ''}
        ${data.winner ? `<p style="color: var(--accent-gold); font-size: 1.1rem;">🏆 Tournament Winner: ${data.winner}!</p>` : ''}
        ${!data.winner && roundNumber < 6 ? `<p><strong>Next:</strong> Click "▶ Advance" to create the next round's matches.</p>` : ''}
      `;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}
