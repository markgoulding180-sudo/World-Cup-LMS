// Admin panel JavaScript - v7 - Points-based System

const ADMIN_PIN = '1234';
let currentUserBatch = 0;

// Simulation history stored in memory + loaded from DB
let simHistory = [];
let currentSimIndex = 0;

document.addEventListener('DOMContentLoaded', function() {
  checkAdminAccess();
});

async function checkAdminAccess() {
  const token = localStorage.getItem('wc_lms_token');
  if (!token) { window.location.href = '/login.html'; return; }
  const pinVerified = sessionStorage.getItem('admin_pin_verified');
  if (pinVerified === 'true') { loadAdminData(); return; }
  showPinModal();
}

function showPinModal() {
  const pin = prompt('Enter admin PIN:');
  if (pin === ADMIN_PIN) { sessionStorage.setItem('admin_pin_verified', 'true'); loadAdminData(); }
  else { alert('Incorrect PIN'); window.location.href = '/index.html'; }
}

async function loadAdminData() {
  console.log('Admin panel loaded');
  await loadRoundStatus();
  await loadMatchesForResults();
  await loadAllPicks();
  await loadSimHistory();
}

// ─── ROUND STATUS ─────────────────────────────────────────
async function loadRoundStatus() {
  const container = document.getElementById('round-status');
  try {
    const response = await fetch('/api/rounds');
    const data = await response.json();
    if (!response.ok) { container.innerHTML = `<p class="error">Error: ${data.error}</p>`; return; }
    let html = '<div class="rounds-list">';
    data.rounds?.forEach(round => {
      const statusClass = round.status === 'open' ? 'status-open' : round.status === 'closed' ? 'status-closed' : 'status-upcoming';
      html += `<div class="round-item"><span class="round-name">${round.name}</span><span class="round-status ${statusClass}">${round.status}</span></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (error) { container.innerHTML = `<p class="error">Error loading rounds</p>`; }
}

// ─── MATCHES FOR RESULTS ENTRY ────────────────────────────
async function loadMatchesForResults() {
  const container = document.getElementById('match-list');
  const resultContainer = document.getElementById('result-entry');
  try {
    const response = await fetch('/api/matches?limit=200');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const matches = data.matches || [];
    if (matches.length === 0) {
      resultContainer.innerHTML = '<p class="text-secondary">No matches found.</p>';
    } else {
      const byMatchday = { 1: [], 2: [], 3: [] };
      const koMatches = [];
      matches.forEach(m => { if (m.matchday && byMatchday[m.matchday]) byMatchday[m.matchday].push(m); else koMatches.push(m); });
      let html = '<div class="matches-for-entry">';
      html += `<div class="match-filter"><input type="text" id="match-filter-input" placeholder="Filter by team name..." onkeyup="filterMatches()"><button class="btn btn-secondary btn-sm" onclick="clearFilter()">Clear</button></div>`;
      [1, 2, 3].forEach(md => {
        if (byMatchday[md].length === 0) return;
        html += `<h4 class="matchday-header-admin">Matchday ${md}</h4>`;
        byMatchday[md].forEach(match => { html += buildMatchRow(match); });
      });
      if (koMatches.length > 0) {
        html += `<h4 class="matchday-header-admin">Knockout Stage</h4>`;
        koMatches.forEach(match => { html += buildMatchRow(match); });
      }
      html += '</div>';
      resultContainer.innerHTML = html;
    }
    const upcomingCount = matches.filter(m => m.status === 'upcoming').length;
    const finishedCount = matches.filter(m => m.status === 'finished').length;
    container.innerHTML = `<p><strong>Upcoming:</strong> ${upcomingCount} matches</p><p><strong>Finished:</strong> ${finishedCount} matches</p>`;
  } catch (error) {
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
          <div class="admin-team-header"><img src="${match.home_team?.flag_url}" alt="" class="admin-card-flag"><span class="admin-card-name">${match.home_team?.name}</span></div>
          ${!isFinished ? `<input type="number" id="score-${match.id}-home" min="0" placeholder="0" class="admin-card-input">` : `<div class="admin-card-result">${match.home_score}</div>`}
        </div>
        <div class="admin-vs-card">
          <span class="admin-vs-text">v</span>
          ${!isFinished ? `<button class="btn admin-save-btn" onclick="submitResult('${match.id}')">Save</button>` : '<span class="admin-finished-text">FT</span>'}
        </div>
        <div class="admin-team-card">
          <div class="admin-team-header"><img src="${match.away_team?.flag_url}" alt="" class="admin-card-flag"><span class="admin-card-name">${match.away_team?.name}</span></div>
          ${!isFinished ? `<input type="number" id="score-${match.id}-away" min="0" placeholder="0" class="admin-card-input">` : `<div class="admin-card-result">${match.away_score}</div>`}
        </div>
      </div>
    </div>`;
}

async function submitResult(matchId) {
  const homeScore = document.getElementById(`score-${matchId}-home`).value;
  const awayScore = document.getElementById(`score-${matchId}-away`).value;
  if (homeScore === '' || awayScore === '') { alert('Please enter both scores'); return; }
  try {
    const response = await fetch('/api/admin-results', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, home_score: parseInt(homeScore), away_score: parseInt(awayScore) })
    });
    const data = await response.json();
    if (response.ok) { alert(`Result saved!\n${data.match.home} ${data.match.score} ${data.match.away}\nPoints awarded: ${data.pointsAwarded || 0}`); loadAdminData(); }
    else alert('Error: ' + data.error);
  } catch (error) { alert('Error saving result: ' + error.message); }
}

async function loadAllPicks() {
  const container = document.getElementById('all-picks');
  try {
    const response = await fetch('/api/picks?admin=true');
    const data = await response.json();
    if (!response.ok) { container.innerHTML = `<p class="error">Error: ${data.error}</p>`; return; }
    if (!data.picks || data.picks.length === 0) { container.innerHTML = '<p class="text-secondary">No picks yet.</p>'; return; }
    let html = `<div class="picks-summary"><span class="pick-stat">Total: ${data.totalPicks}</span><span class="pick-stat pending">Pending: ${data.stats.pending}</span><span class="pick-stat win">Wins: ${data.stats.win}</span><span class="pick-stat loss">Losses: ${data.stats.loss}</span></div><div class="picks-list">`;
    data.picks.forEach(pick => {
      const statusClass = pick.result === 'pending' ? 'status-pending' : pick.result === 'win' ? 'status-win' : 'status-loss';
      const pointsDisplay = pick.points > 0 ? ` (+${pick.points} pts)` : '';
      html += `<div class="pick-item"><div class="pick-user"><strong>${pick.users?.display_name || 'Unknown'}</strong><span class="pick-round">${pick.rounds?.name || ''}</span></div><div class="pick-team"><img src="${pick.teams?.flag_url}" alt="" class="pick-flag"><span>${pick.teams?.name}</span></div><span class="pick-result ${statusClass}">${pick.result}${pointsDisplay}</span></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (error) { container.innerHTML = `<p class="error">Error loading picks</p>`; }
}

function filterMatches() {
  const filterText = document.getElementById('match-filter-input').value.toLowerCase();
  document.querySelectorAll('.match-entry-row').forEach(row => { row.style.display = row.textContent.toLowerCase().includes(filterText) ? '' : 'none'; });
}

function clearFilter() { document.getElementById('match-filter-input').value = ''; filterMatches(); }

async function updateResultsFromFixturedownload() {
  const statusDiv = document.getElementById('update-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Fetching results...</p>';
  try {
    const token = localStorage.getItem('wc_lms_token');
    const response = await fetch('/api/update-results', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
    const data = await response.json();
    if (response.ok) {
      statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> Results updated!</p><p>Matches updated: ${data.matchesUpdated || 0}</p><p>Points awarded: ${data.pointsAwarded || 0}</p>`;
      loadAdminData();
    } else statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
  } catch (error) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`; }
}

async function importWorldCupData() {
  const statusDiv = document.getElementById('import-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Importing...</p>';
  try {
    const token = localStorage.getItem('wc_lms_token');
    const response = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ action: 'setup' }) });
    const data = await response.json();
    if (response.ok) statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> Import successful!</p><p>Teams found: ${data.teamsFound}</p><p>Matches imported: ${data.matchesInserted}</p>${data.missingTeams ? `<p style="color:orange;">Missing: ${data.missingTeams.join(', ')}</p>` : ''}`;
    else statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
  } catch (error) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`; }
}

async function openRound() {
  const roundId = prompt('Enter Round ID to open:');
  if (!roundId) return;
  const res = await fetch('/api/rounds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', round_id: roundId }) });
  const data = await res.json();
  alert(res.ok ? 'Round opened!' : `Error: ${data.error}`);
  loadAdminData();
}

async function closeRound() {
  const roundId = prompt('Enter Round ID to close:');
  if (!roundId) return;
  const res = await fetch('/api/rounds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close', round_id: roundId }) });
  const data = await res.json();
  alert(res.ok ? 'Round closed!' : `Error: ${data.error}`);
  loadAdminData();
}

// ─── RESET ALL DATA ───────────────────────────────────────
async function resetAllData() {
  const confirm1 = confirm('⚠️ WARNING — This will delete EVERYTHING:\n\n• All picks\n• All tournament entries\n• All matches\n• All rounds\n• All tournaments\n• All teams\n• All user profiles\n• All auth accounts\n\nOnly master_teams (flag images) is preserved.\n\nAre you sure?');
  if (!confirm1) return;
  const confirm2 = prompt('Type RESET to confirm:');
  if (confirm2 !== 'RESET') { alert('Cancelled.'); return; }
  const statusDiv = document.getElementById('reset-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Resetting all data...</p>';
  try {
    const response = await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset', confirm: 'RESET', admin_pin: '1234' }) });
    const data = await response.json();
    if (response.ok) { statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> Reset complete!</p><p>${data.message}</p>`; loadAdminData(); }
    else statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
  } catch (error) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`; }
}

// ─── SETUP TOURNAMENT ─────────────────────────────────────
async function setupTournament() {
  const confirmed = confirm('Setup the World Cup 2026 Last Man Standing tournament?\n\n£30 entry | 100 players max | Points-based system\n\nMake sure you have run Reset All Data first.');
  if (!confirmed) return;
  const statusDiv = document.getElementById('setup-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Setting up tournament...</p>';
  try {
    const response = await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setup', admin_pin: '1234' }) });
    const data = await response.json();
    if (response.ok) { statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> Tournament ready!</p><p>Teams: ${data.teamsAdded} | Matches: ${data.matchesImported}</p>${data.missingTeams ? `<p style="color:orange;">Missing teams: ${data.missingTeams.join(', ')}</p>` : ''}<p>${data.message}</p>`; loadAdminData(); }
    else statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
  } catch (error) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`; }
}

// ─── SIMULATION SECTION ───────────────────────────────────
// Load sim history from DB on page load
async function loadSimHistory() {
  try {
    const response = await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_simulations', admin_pin: '1234' }) });
    const data = await response.json();
    if (response.ok && data.simulations) {
      simHistory = data.simulations;
      if (simHistory.length > 0) {
        currentSimIndex = simHistory.length - 1; // show latest
        renderSimResult(simHistory[currentSimIndex]);
        updateSimNav();
      }
    }
  } catch (e) { console.log('Could not load sim history:', e.message); }
}

// Register users for simulation
async function simRegisterUsers() {
  const userCount = parseInt(document.getElementById('sim-user-count').value) || 50;
  const statusDiv = document.getElementById('sim-register-status');
  const batchCount = Math.ceil(userCount / 10);
  let totalRegistered = 0;

  for (let b = 0; b < batchCount; b++) {
    statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Registering users ${b * 10 + 1}-${Math.min((b + 1) * 10, userCount)}...</p>`;
    try {
      const response = await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'simulate_users', batch: b, admin_pin: '1234' }) });
      const data = await response.json();
      if (response.ok) totalRegistered += data.registered || 0;
      else { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`; return; }
    } catch (e) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${e.message}</p>`; return; }
  }
  statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${totalRegistered} users registered and entered. Ready to run simulations.</p>`;
}

// Run a simulation — reuses existing users, clears game data, runs full tournament
async function runSimulation() {
  const statusDiv = document.getElementById('sim-run-status');

  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Running simulation... (30-60 seconds, please wait)</p>';

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sim_run', admin_pin: '1234' })
    });

    // Debug: log raw response if not OK
    if (!response.ok) {
      const rawText = await response.text();
      console.error('API Error Response:', rawText);
      statusDiv.innerHTML = `<p style="color: var(--accent-red);"><strong>API Error ${response.status}:</strong></p><pre style="font-size: 0.75rem; overflow: auto; max-height: 200px; background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 0.25rem;">${rawText.substring(0, 1000)}</pre>`;
      return;
    }

    const data = await response.json();

    if (response.ok && data.summary) {
      // Add to local history
      simHistory.push({ summary: data.summary, sim_number: data.summary.simNumber, total_users: data.summary.totalUsers, winner: data.summary.winner, final_top5: data.summary.finalTop5 });
      currentSimIndex = simHistory.length - 1;
      renderSimResult(simHistory[currentSimIndex]);
      updateSimNav();
      statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> Sim #${data.summary.simNumber} complete!</p>`;
      loadAdminData();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data?.error || 'Simulation timed out. Try fewer users.'}</p>`;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

// Render a simulation result into the results box
function renderSimResult(sim) {
  const container = document.getElementById('sim-results-box');
  if (!sim) { container.innerHTML = '<p style="color: var(--text-secondary);">No simulations yet.</p>'; return; }

  const s = sim.summary || sim;
  const stages = s.survivorsPerStage || [];

  // Find stage with most points awarded
  let bestStage = { stage: 'N/A', pointsAwarded: 0 };
  stages.forEach(st => { if ((st.pointsAwarded || 0) > bestStage.pointsAwarded) bestStage = st; });

  const stagesHtml = stages.map(stage => {
    const top5 = stage.top5 || [];
    const top5Html = top5.slice(0, 3).map((p, i) => 
      `<span style="color: ${i === 0 ? 'gold' : i === 1 ? '#c0c0c0' : '#cd7f32'};">${p.name} (${p.points})</span>`
    ).join(', ');
    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding: 0.4rem 0.6rem;">${stage.stage}</td>
        <td style="padding: 0.4rem 0.6rem; text-align: center; color: var(--accent-green);">+${stage.pointsAwarded || 0}</td>
        <td style="padding: 0.4rem 0.6rem; font-size: 0.75rem;">${top5Html}</td>
      </tr>`;
  }).join('');

  const finalTop5 = s.finalTop5 || [];
  const finalTop5Html = finalTop5.map((p, i) => 
    `<div style="display: flex; justify-content: space-between; padding: 0.3rem 0; ${i === 0 ? 'color: gold; font-weight: bold;' : ''}">
      <span>${i + 1}. ${p.name}</span>
      <span>${p.points} pts (${p.wins} wins)</span>
    </div>`
  ).join('');

  container.innerHTML = `
    <div style="padding: 1rem; background: var(--bg-secondary); border-radius: 0.5rem; border: 1px solid #9333ea;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h3 style="color: gold; margin: 0;">🏆 Sim #${sim.sim_number || s.simNumber}</h3>
        <span style="font-size: 0.8rem; color: var(--text-secondary);">${simHistory.length} sim(s) total</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.5rem; margin-bottom: 1rem;">
        <div style="background: rgba(255,255,255,0.05); padding: 0.5rem; border-radius: 0.4rem; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary);">Users</div>
          <div style="font-size: 1.2rem; font-weight: bold;">${sim.total_users || s.totalUsers}</div>
        </div>
        <div style="background: rgba(255,255,255,0.05); padding: 0.5rem; border-radius: 0.4rem; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary);">Winner</div>
          <div style="font-size: 1rem; font-weight: bold; color: gold;">${sim.winner || s.winner}</div>
        </div>
      </div>
      <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem;">Final Standings:</p>
      <div style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 0.4rem; margin-bottom: 1rem;">
        ${finalTop5Html}
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">
            <th style="padding: 0.4rem 0.6rem; text-align: left;">Stage</th>
            <th style="padding: 0.4rem 0.6rem;">Points</th>
            <th style="padding: 0.4rem 0.6rem; text-align: left;">Top 3</th>
          </tr>
        </thead>
        <tbody>${stagesHtml}</tbody>
      </table>
    </div>`;
}

// Navigation arrows
function simPrev() {
  if (currentSimIndex > 0) { currentSimIndex--; renderSimResult(simHistory[currentSimIndex]); updateSimNav(); }
}

function simNext() {
  if (currentSimIndex < simHistory.length - 1) { currentSimIndex++; renderSimResult(simHistory[currentSimIndex]); updateSimNav(); }
}

function updateSimNav() {
  const prevBtn = document.getElementById('sim-prev-btn');
  const nextBtn = document.getElementById('sim-next-btn');
  const counter = document.getElementById('sim-counter');
  if (prevBtn) prevBtn.disabled = currentSimIndex <= 0;
  if (nextBtn) nextBtn.disabled = currentSimIndex >= simHistory.length - 1;
  if (counter) counter.textContent = simHistory.length > 0 ? `${currentSimIndex + 1} / ${simHistory.length}` : '0 / 0';
}

async function clearSimHistory() {
  const confirmed = confirm('Clear all saved simulation history?');
  if (!confirmed) return;
  try {
    await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear_simulations', admin_pin: '1234' }) });
    simHistory = [];
    currentSimIndex = 0;
    document.getElementById('sim-results-box').innerHTML = '<p style="color: var(--text-secondary);">No simulations yet. Run one above.</p>';
    updateSimNav();
  } catch (e) { alert('Error clearing history: ' + e.message); }
}

// ─── CHECK API FOR KNOCKOUT MATCHES ─────────────────────
async function checkKoMatches(roundNumber) {
  const roundNames = { 2: 'Round of 32', 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
  const statusDiv = document.getElementById('check-ko-status');
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Checking football-data.org for ${roundNames[roundNumber]}...</p>`;
  
  try {
    const response = await fetch('/api/check-ko-matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round_number: roundNumber, admin_pin: '1234' })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);"><i class="fas fa-exclamation-circle"></i> Error: ${data.error}</p>`;
      return;
    }
    
    if (data.found && data.loaded) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>
        ${data.missingTeams ? `<p style="color: orange;">Missing teams: ${data.missingTeams.join(', ')}</p>` : ''}
        <p style="font-size: 0.85rem; color: var(--text-secondary);">You can now open the round for users to make picks.</p>
      `;
      loadAdminData();
    } else if (data.found && data.alreadyLoaded) {
      statusDiv.innerHTML = `<p style="color: var(--accent-blue);"><i class="fas fa-info-circle"></i> ${data.message}</p>`;
    } else if (data.found && !data.loadable) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-red);"><i class="fas fa-exclamation-triangle"></i> ${data.message}</p>
        <p>Missing teams: ${data.missingTeams?.join(', ') || 'Unknown'}</p>
        <p style="font-size: 0.85rem;">API matches found: ${data.apiMatchesFound}</p>
      `;
    } else {
      statusDiv.innerHTML = `
        <p style="color: var(--text-secondary);"><i class="fas fa-clock"></i> ${data.message}</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">FIFA typically announces fixtures within 2-4 hours of the previous round completing. Try again later.</p>
      `;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);"><i class="fas fa-exclamation-circle"></i> Error: ${error.message}</p>`;
  }
}

// ─── STEP BY STEP SIMULATION ──────────────────────────────
async function simulateUsersBatch() {
  const statusDiv = document.getElementById('simulate-users-status');
  if (currentUserBatch >= 5) { statusDiv.innerHTML = '<p style="color: var(--accent-green);">✅ All 50 users registered!</p>'; return; }
  const batchNum = currentUserBatch + 1;
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Registering batch ${batchNum} of 5...</p>`;
  try {
    const response = await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'simulate_users', batch: currentUserBatch, admin_pin: '1234' }) });
    const data = await response.json();
    if (response.ok) {
      currentUserBatch++;
      const remaining = 50 - (currentUserBatch * 10);
      statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> Batch ${batchNum} done! ${data.registered} users added.</p><p>Total: ${currentUserBatch * 10}. ${remaining > 0 ? remaining + ' more.' : 'All done!'}</p>${remaining > 0 ? `<button class="btn btn-secondary" onclick="simulateUsersBatch()">Add Next 10 Users</button>` : ''}`;
      loadAdminData();
    } else statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
  } catch (error) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`; }
}

async function simulatePicks(matchday) {
  if (!confirm(`Make Matchday ${matchday} picks for all active users?`)) return;
  const statusDiv = document.getElementById('simulate-picks-status');
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Making Matchday ${matchday} picks...</p>`;
  try {
    const response = await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'simulate_picks', matchday, admin_pin: '1234' }) });
    const data = await response.json();
    if (response.ok) { statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>`; loadAdminData(); }
    else statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
  } catch (error) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`; }
}

async function simulateResults(matchday) {
  if (!confirm(`Simulate random results for Matchday ${matchday}?`)) return;
  const statusDiv = document.getElementById('simulate-results-status');
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Simulating Matchday ${matchday} results...</p>`;
  try {
    const response = await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'simulate_results', matchday, admin_pin: '1234' }) });
    const data = await response.json();
    if (response.ok) { statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>`; loadAdminData(); }
    else statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
  } catch (error) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`; }
}

async function createKnockoutMatches() {
  if (!confirm('Create Round of 32 from group standings?\n\nTop 2 from each of 12 groups (24) + best 8 third-placed = 32 teams')) return;
  const statusDiv = document.getElementById('create-knockout-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Creating R32 matches...</p>';
  try {
    const response = await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_knockout_matches', admin_pin: '1234' }) });
    const data = await response.json();
    if (response.ok) { statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p><p>Teams qualified: ${data.teamsQualified} | Matches: ${data.matchesCreated}</p>`; loadAdminData(); }
    else statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
  } catch (error) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`; }
}

async function createNextRoundMatches(fromRoundNumber) {
  const roundNames = { 2: 'Round of 16', 3: 'Quarter Finals', 4: 'Semi Finals', 5: 'Final' };
  if (!confirm(`Create ${roundNames[fromRoundNumber]} from Round ${fromRoundNumber} winners?`)) return;
  const statusDiv = document.getElementById('simulate-knockout-status');
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Creating ${roundNames[fromRoundNumber]} matches...</p>`;
  try {
    const response = await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_next_round_matches', from_round_number: fromRoundNumber, admin_pin: '1234' }) });
    const data = await response.json();
    if (response.ok) { statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>`; loadAdminData(); }
    else statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
  } catch (error) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`; }
}

async function simulateKnockoutPicks(roundNumber) {
  const roundNames = { 2: 'Round of 32', 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
  if (!confirm(`Make picks for ${roundNames[roundNumber]}?`)) return;
  const statusDiv = document.getElementById('simulate-knockout-status');
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Making ${roundNames[roundNumber]} picks...</p>`;
  try {
    const response = await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'simulate_knockout_picks', round_number: roundNumber, admin_pin: '1234' }) });
    const data = await response.json();
    if (response.ok) { statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>`; loadAdminData(); }
    else statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
  } catch (error) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`; }
}

async function simulateKnockoutResults(roundNumber) {
  const roundNames = { 2: 'Round of 32', 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
  if (!confirm(`Simulate results for ${roundNames[roundNumber]}? No draws — a winner is forced.`)) return;
  const statusDiv = document.getElementById('simulate-knockout-status');
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Simulating ${roundNames[roundNumber]} results...</p>`;
  try {
    const response = await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'simulate_knockout_results', round_number: roundNumber, admin_pin: '1234' }) });
    const data = await response.json();
    if (response.ok) { 
      statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${data.message}</p>${data.winner ? `<p style="color:gold; font-size:1.1rem;">🏆 Tournament Winner: ${data.winner}!</p>` : ''}`; 
      loadAdminData(); 
    }
    else statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
  } catch (error) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`; }
}
