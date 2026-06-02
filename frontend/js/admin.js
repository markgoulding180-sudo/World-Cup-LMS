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
  await loadPollingStatus();
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
    
    const select = document.getElementById('round-select');
    select.innerHTML = '<option value="">Select round...</option>';
    
    let html = '<div class="rounds-list">';
    data.rounds?.forEach(round => {
      const statusClass = round.status === 'open' ? 'status-open' : round.status === 'closed' ? 'status-closed' : 'status-upcoming';
      const picksForceClosedBadge = round.picks_closed ? '<span style="font-size:0.7rem;background:#ef4444;color:#fff;padding:2px 6px;border-radius:3px;margin-left:6px;">PICKS FORCED CLOSED</span>' : '';
      const isOpen = round.status === 'open';

      html += `
        <div class="round-item" style="flex-wrap:wrap;gap:0.5rem;align-items:center;">
          <span class="round-name">${round.name}</span>
          <span class="round-status ${statusClass}">${round.status}</span>
          ${picksForceClosedBadge}
          ${isOpen ? `
            <div style="margin-left:auto;display:flex;gap:0.4rem;flex-wrap:wrap;">
              ${round.picks_closed 
                ? `<button class="btn btn-sm" onclick="forcePicksOpen('${round.id}')" style="background:rgba(34,197,94,0.2);border:1px solid #22c55e;color:#22c55e;font-size:0.75rem;padding:0.25rem 0.6rem;">
                    <i class="fas fa-lock-open"></i> Re-open Picks
                  </button>`
                : `<button class="btn btn-sm" onclick="forcePicksClosed('${round.id}')" style="background:rgba(239,68,68,0.2);border:1px solid #ef4444;color:#ef4444;font-size:0.75rem;padding:0.25rem 0.6rem;">
                    <i class="fas fa-lock"></i> Force Close Picks
                  </button>`
              }
            </div>
          ` : ''}
        </div>`;

      select.innerHTML += `<option value="${round.id}">${round.name} (${round.status})</option>`;
      
      // Also populate deadline round dropdown
      const deadlineSelect = document.getElementById('deadline-round-select');
      if (deadlineSelect) {
        deadlineSelect.innerHTML += `<option value="${round.id}">${round.name} (${round.status})</option>`;
      }
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (error) { container.innerHTML = `<p class="error">Error loading rounds</p>`; }
}

async function forcePicksClosed(roundId) {
  if (!confirm('Force close picks for this round? Users will not be able to submit picks until you re-open them.')) return;
  const res = await fetch('/api/rounds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'force_close_picks', round_id: roundId })
  });
  const data = await res.json();
  if (res.ok) { alert('✓ Picks forcibly closed. Round remains open.'); loadRoundStatus(); }
  else alert('Error: ' + data.error);
}

async function forcePicksOpen(roundId) {
  const res = await fetch('/api/rounds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'force_open_picks', round_id: roundId })
  });
  const data = await res.json();
  if (res.ok) { alert('✓ Picks re-opened.'); loadRoundStatus(); }
  else alert('Error: ' + data.error);
}

// ─── TRIGGER ROUND DEADLINE ───────────────────────────────
async function triggerRoundDeadlineForSelected() {
  const roundId = document.getElementById('deadline-round-select').value;
  if (!roundId) {
    alert('Please select a round first');
    return;
  }
  
  if (!confirm('Trigger deadline for this round?\n\nThis will close picks and auto-assign teams to users who missed the deadline.\n\nAre you sure?')) return;
  
  const statusDiv = document.getElementById('round-deadline-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Closing round and running auto-pick...</p>';
  
  try {
    // Get round details
    const roundsRes = await fetch('/api/rounds');
    const roundsData = await roundsRes.json();
    const selectedRound = roundsData.rounds?.find(r => r.id === roundId);
    
    if (!selectedRound) {
      statusDiv.innerHTML = '<p style="color: var(--accent-red);">Round not found.</p>';
      return;
    }
    
    // Call the trigger_deadline API (closes picks + auto-picks for all users in one call)
    const deadlineRes = await fetch('/api/rounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trigger_deadline', round_id: selectedRound.id })
    });
    
    const deadlineData = await deadlineRes.json();
    
    if (deadlineRes.ok) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-green);">
          <i class="fas fa-check-circle"></i> 
          ${deadlineData.message}
        </p>
      `;
      loadRoundStatus();
      loadAllPicks();
    } else {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${deadlineData.error}</p>`;
    }
    
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
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

async function openSelectedRound() {
  const select = document.getElementById('round-select');
  const roundId = select.value;
  if (!roundId) { alert('Please select a round'); return; }
  const res = await fetch('/api/rounds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', round_id: roundId }) });
  const data = await res.json();
  alert(res.ok ? 'Round opened!' : `Error: ${data.error}`);
  loadAdminData();
}

async function closeSelectedRound() {
  const select = document.getElementById('round-select');
  const roundId = select.value;
  if (!roundId) { alert('Please select a round'); return; }
  
  // Get current round info to find next round
  const selectedOption = select.options[select.selectedIndex];
  const roundText = selectedOption.text;
  const roundMatch = roundText.match(/Round (\d+)/);
  const currentRoundNum = roundMatch ? parseInt(roundMatch[1]) : 0;
  const nextRoundNum = currentRoundNum + 1;
  
  // Close current round
  const res = await fetch('/api/rounds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close', round_id: roundId }) });
  if (!res.ok) {
    const data = await res.json();
    alert(`Error: ${data.error}`);
    return;
  }
  
  // Find and open next round
  const nextRoundOption = Array.from(select.options).find(opt => opt.text.includes(`Round ${nextRoundNum}`) || (nextRoundNum === 2 && opt.text.includes('Round of 32')) || (nextRoundNum === 3 && opt.text.includes('Round of 16')));
  
  if (nextRoundOption && nextRoundOption.value) {
    const openRes = await fetch('/api/rounds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', round_id: nextRoundOption.value }) });
    if (openRes.ok) {
      alert(`Round closed! ${nextRoundOption.text.split('(')[0].trim()} is now open.\n\nUsers should refresh their dashboard to see the new matches.`);
    } else {
      alert('Round closed! (Next round could not be opened automatically)');
    }
  } else {
    alert('Round closed! (No next round to open)');
  }
  
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
  const confirmed = confirm('Setup the World Cup 2026 Last Man Standing tournament?\n\n£20 entry | 100 players max | Points-based system\n\nMake sure you have run Reset All Data first.');
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

  let testUserInfo = null;
  
  for (let b = 0; b < batchCount; b++) {
    statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Registering users ${b * 10 + 1}-${Math.min((b + 1) * 10, userCount)}...</p>`;
    try {
      const response = await fetch('/api/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'simulate_users', batch: b, admin_pin: '1234' }) });
      const data = await response.json();
      if (response.ok) {
        totalRegistered += data.registered || 0;
        if (data.testUser) testUserInfo = data.testUser;
      }
      else { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`; return; }
    } catch (e) { statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${e.message}</p>`; return; }
  }
  
  let html = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> ${totalRegistered} users registered and entered. Ready to run simulations.</p>`;
  
  if (testUserInfo) {
    html += `
      <div style="background: rgba(34,197,94,0.1); padding: 1rem; border-radius: 0.5rem; border: 1px solid #22c55e; margin-top: 1rem;">
        <p style="color: #22c55e; font-weight: bold;"><i class="fas fa-user"></i> First user created with test credentials:</p>
        <p style="margin: 0.5rem 0;"><strong>Email:</strong> ${testUserInfo.email}</p>
        <p style="margin: 0.5rem 0;"><strong>Password:</strong> ${testUserInfo.password}</p>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
          Log out and log in with these credentials to test the full player experience.
        </p>
      </div>
    `;
  }
  
  statusDiv.innerHTML = html;
}

// Run a simulation — reuses existing users, clears game data, runs full tournament
// BROKEN INTO STEPS to avoid Vercel 10s timeout (18 API calls, each under 2 seconds)
async function runSimulation() {
  const simLives = parseInt(document.getElementById('sim-lives-select')?.value) || 5;
  const statusDiv = document.getElementById('sim-run-status');
  const steps = [
    { action: 'sim_init', name: 'Initializing simulation...', track: false },
    { action: 'sim_group_picks', matchday: 1, name: 'Matchday 1 picks...', track: true, stage: 'Matchday 1' },
    { action: 'sim_group_results', matchday: 1, name: 'Matchday 1 results...', track: false },
    { action: 'sim_group_picks', matchday: 2, name: 'Matchday 2 picks...', track: true, stage: 'Matchday 2' },
    { action: 'sim_group_results', matchday: 2, name: 'Matchday 2 results...', track: false },
    { action: 'sim_group_picks', matchday: 3, name: 'Matchday 3 picks...', track: true, stage: 'Matchday 3' },
    { action: 'sim_group_results', matchday: 3, name: 'Matchday 3 results...', track: false },
    { action: 'sim_create_r32', name: 'Creating Round of 32...', track: false },
    { action: 'sim_ko_round', round: 2, name: 'Round of 32...', track: true, stage: 'Round of 32' },
    { action: 'sim_advance', from: 2, name: 'Advancing to R16...', track: false },
    { action: 'sim_ko_round', round: 3, name: 'Round of 16...', track: true, stage: 'Round of 16' },
    { action: 'sim_advance', from: 3, name: 'Advancing to QF...', track: false },
    { action: 'sim_ko_round', round: 4, name: 'Quarter Finals...', track: true, stage: 'Quarter Finals' },
    { action: 'sim_advance', from: 4, name: 'Advancing to SF...', track: false },
    { action: 'sim_ko_round', round: 5, name: 'Semi Finals...', track: true, stage: 'Semi Finals' },
    { action: 'sim_advance', from: 5, name: 'Advancing to Final...', track: false },
    { action: 'sim_ko_round', round: 6, name: 'Final...', track: true, stage: 'Final' },
    { action: 'sim_finalize', name: 'Finalizing...', track: false }
  ];

  let summary = null;
  let simMeta = null;
  const participationData = []; // Track participation per stage

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Step ${i + 1}/${steps.length}: ${step.name}</p>`;

    try {
      const body = { action: step.action, sim_lives: simLives, admin_pin: '1234' };
      if (step.matchday) body.matchday = step.matchday;
      if (step.round) body.round_number = step.round;
      if (step.from) body.from_round = step.from;

      const response = await fetch('/api/reset-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      // Debug: log raw response if not OK
      if (!response.ok) {
        const rawText = await response.text();
        console.error(`API Error at step ${i + 1}:`, rawText);
        statusDiv.innerHTML = `<p style="color: var(--accent-red);"><strong>Step ${i + 1} Error ${response.status}:</strong></p><pre style="font-size: 0.75rem; overflow: auto; max-height: 200px; background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 0.25rem;">${rawText.substring(0, 1000)}</pre>`;
        return;
      }

      const data = await response.json();

      // Capture sim metadata from init step
      if (step.action === 'sim_init') {
        console.log('Sim init response:', data);
        if (!data.simNumber) {
          console.error('simNumber missing from init response!');
          statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: Init step failed - no sim number returned</p>`;
          return;
        }
        simMeta = { 
          sim_number: data.simNumber, 
          total_users: data.totalUsers, 
          sim_lives: data.simLives 
        };
        console.log('simMeta set:', simMeta);
      }

      // Track participation data from pick steps
      if (step.track && data.participation) {
        participationData.push({
          stage: step.stage,
          ...data.participation
        });
      }

      // Add metadata to finalize step
      if (step.action === 'sim_finalize') {
        console.log('Finalize step - simMeta:', simMeta);
        if (!simMeta) {
          statusDiv.innerHTML = '<p style="color: var(--accent-red);">Error: Simulation metadata not found. Please try again.</p>';
          return;
        }
        const finalBody = { 
          action: 'sim_finalize', 
          admin_pin: '1234',
          sim_number: simMeta.sim_number,
          total_users: simMeta.total_users,
          sim_lives: simMeta.sim_lives,
          participation_data: participationData
        };
        console.log('Finalize body:', finalBody);
        // Send the request with metadata
        const finalResponse = await fetch('/api/reset-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalBody)
        });
        if (!finalResponse.ok) {
          const rawText = await finalResponse.text();
          statusDiv.innerHTML = `<p style="color: var(--accent-red);"><strong>Finalize Error:</strong></p><pre style="font-size: 0.75rem;">${rawText.substring(0, 500)}</pre>`;
          return;
        }
        const finalData = await finalResponse.json();
        if (finalData.summary) {
          summary = finalData.summary;
          // Add participation data to summary for display
          summary.participationByStage = participationData;
        }
        continue;
      }

      if (data.summary) summary = data.summary;
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error at step ${i + 1}: ${error.message}</p>`;
      return;
    }
  }

  if (summary) {
    simHistory.push({ summary, sim_number: summary.simNumber, total_users: summary.totalUsers, winner: summary.winner, final_top5: summary.finalTop5 });
    currentSimIndex = simHistory.length - 1;
    renderSimResult(simHistory[currentSimIndex]);
    updateSimNav();
    statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> Sim #${summary.simNumber} complete! Winner: ${summary.winner}</p>`;
    loadAdminData();
  }
}

// Render a simulation result into the results box
function renderSimResult(sim) {
  const container = document.getElementById('sim-results-box');
  if (!sim) { container.innerHTML = '<p style="color: var(--text-secondary);">No simulations yet.</p>'; return; }

  const s = sim.summary || sim;
  const stages = s.survivorsPerStage || [];
  const participation = s.participationByStage || [];

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

  // Build participation table
  const participationHtml = participation.length > 0 ? `
    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 1rem;">
      <thead>
        <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">
          <th style="padding: 0.4rem 0.6rem; text-align: left;">Stage</th>
          <th style="padding: 0.4rem 0.6rem; text-align: center;">Eligible</th>
          <th style="padding: 0.4rem 0.6rem; text-align: center; color: #22c55e;">Picked</th>
          <th style="padding: 0.4rem 0.6rem; text-align: center; color: #ef4444;">Couldn't Pick</th>
          <th style="padding: 0.4rem 0.6rem; text-align: center;">Pick Rate</th>
        </tr>
      </thead>
      <tbody>
        ${participation.map(p => `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 0.4rem 0.6rem;">${p.stage}</td>
            <td style="padding: 0.4rem 0.6rem; text-align: center;">${p.totalEligible}</td>
            <td style="padding: 0.4rem 0.6rem; text-align: center; color: #22c55e;">${p.couldPick}</td>
            <td style="padding: 0.4rem 0.6rem; text-align: center; color: ${p.couldNotPick > 0 ? '#ef4444' : 'inherit'};">${p.couldNotPick}</td>
            <td style="padding: 0.4rem 0.6rem; text-align: center; font-weight: bold;">${p.pickRate}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(239,68,68,0.1); border-radius: 0.4rem; border-left: 3px solid #ef4444;">
      <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary);">
        <strong style="color: #ef4444;">⚠️ Team Exhaustion:</strong> 
        Players who "Couldn't Pick" had no valid teams remaining (all previously used).
        ${participation.filter(p => p.couldNotPick > 0).length} rounds had players excluded due to team exhaustion.
      </p>
    </div>
  ` : '';

  // Most picked teams
  const mostPickedTeams = s.mostPickedTeams || [];
  const teamsHtml = mostPickedTeams.length > 0 ? `
    <div style="margin-top: 1rem;">
      <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem;">Most Picked Teams:</p>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        ${mostPickedTeams.map((t, i) => `
          <span style="background: rgba(255,215,0,${0.1 + (0.05 * (10-i))}); padding: 0.3rem 0.6rem; border-radius: 0.3rem; font-size: 0.75rem; border: 1px solid rgba(255,215,0,0.3);">
            ${i+1}. ${t.name} (${t.count}x)
          </span>
        `).join('')}
      </div>
    </div>
  ` : '';

  // Pick stats
  const pickStatsHtml = s.totalPicksMade ? `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 1rem;">
      <div style="background: rgba(255,255,255,0.05); padding: 0.5rem; border-radius: 0.4rem; text-align: center;">
        <div style="font-size: 0.7rem; color: var(--text-secondary);">Total Picks</div>
        <div style="font-size: 1rem; font-weight: bold;">${s.totalPicksMade}</div>
      </div>
      <div style="background: rgba(34,197,94,0.1); padding: 0.5rem; border-radius: 0.4rem; text-align: center;">
        <div style="font-size: 0.7rem; color: #22c55e;">Wins</div>
        <div style="font-size: 1rem; font-weight: bold; color: #22c55e;">${s.winningPicks}</div>
      </div>
      <div style="background: rgba(239,68,68,0.1); padding: 0.5rem; border-radius: 0.4rem; text-align: center;">
        <div style="font-size: 0.7rem; color: #ef4444;">Losses</div>
        <div style="font-size: 1rem; font-weight: bold; color: #ef4444;">${s.losingPicks}</div>
      </div>
    </div>
  ` : '';

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
          <div style="font-size: 0.75rem; color: var(--accent-green);">${s.winnerPoints || 0} pts</div>
        </div>
      </div>
      
      ${participationHtml}
      ${pickStatsHtml}
      ${teamsHtml}
      
      <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 1rem 0 0.5rem;">Final Standings:</p>
      <div style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 0.4rem; margin-bottom: 1rem; max-height: 200px; overflow-y: auto;">
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
async function debugApi() {
  const statusDiv = document.getElementById('debug-api-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Fetching API data...</p>';
  
  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'debug_api', admin_pin: '1234' })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${data.error}</p>`;
      return;
    }
    
    statusDiv.innerHTML = `
      <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 0.25rem; max-height: 300px; overflow: auto;">
        <p><strong>Total Matches:</strong> ${data.totalMatches}</p>
        <p><strong>Stages:</strong> ${data.stages?.join(', ')}</p>
        <hr style="margin: 0.5rem 0;">
        <p><strong>Sample Knockout Match:</strong></p>
        <pre style="font-size: 0.7rem; white-space: pre-wrap;">${JSON.stringify(data.sampleKnockoutMatch, null, 2)}</pre>
      </div>
    `;
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
}

async function checkKoMatches(roundNumber) {
  const roundNames = { 2: 'Round of 32', 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
  const statusDiv = document.getElementById('check-ko-status');
  statusDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Checking football-data.org for ${roundNames[roundNumber]}...</p>`;
  
  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_ko_matches', round_number: roundNumber, admin_pin: '1234' })
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
    } else if (data.found && data.drawPending) {
      statusDiv.innerHTML = `
        <p style="color: var(--accent-gold);"><i class="fas fa-clock"></i> ${data.message}</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">${data.note}</p>
      `;
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

// ─── MANUAL AUTO-PICK FOR TESTING ─────────────────────────
async function manualAutoPick() {
  if (!confirm('Run auto-pick for all users who missed picks in the current round?')) return;
  const statusDiv = document.getElementById('manual-autopick-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Running auto-pick...</p>';
  
  try {
    // Get tournament ID
    const tourneyResponse = await fetch('/api/tournaments');
    const tourneyData = await tourneyResponse.json();
    const tournamentId = tourneyData.tournaments?.[0]?.id;
    
    if (!tournamentId) {
      statusDiv.innerHTML = '<p style="color: var(--accent-red);">No tournament found.</p>';
      return;
    }
    
    // Get all active users
    const entriesResponse = await fetch('/api/entries');
    const entriesData = await entriesResponse.json();
    const activeUsers = entriesData.entries?.filter(e => e.status === 'active') || [];
    
    let autoPicksCreated = 0;
    
    // For each active user, run auto-pick
    for (const entry of activeUsers) {
      // We need to call the auto-pick API for each user
      // Since auto-pick requires auth, we'll use a workaround:
      // Call the reset-all API with a new action
      const response = await fetch('/api/reset-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'manual_autopick_for_user', 
          user_id: entry.user_id,
          tournament_id: tournamentId,
          admin_pin: '1234' 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        autoPicksCreated += data.auto_picks_created || 0;
      }
    }
    
    statusDiv.innerHTML = `<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> Auto-pick complete! Created ${autoPicksCreated} picks for users who missed deadlines.</p>`;
    loadAdminData();
    
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: var(--accent-red);">Error: ${error.message}</p>`;
  }
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

// ─── POLLING TOGGLE ──────────────────────────────────────────────────────────
// Polling state lives in the DB (master_clock.polling_enabled).
// This affects ALL users on ALL devices immediately.

async function loadPollingStatus() {
  const btn = document.getElementById('polling-toggle-btn');
  const statusText = document.getElementById('polling-status-text');
  if (!btn || !statusText) return;

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_polling_status', admin_pin: ADMIN_PIN })
    });
    const data = await response.json();
    const enabled = data.polling_enabled === true;
    renderPollingButton(enabled);
  } catch (e) {
    btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Could not load polling status';
    btn.style.background = 'rgba(239,68,68,0.2)';
    btn.style.borderColor = 'var(--accent-red)';
    btn.style.color = 'var(--accent-red)';
  }
}

function renderPollingButton(enabled) {
  const btn = document.getElementById('polling-toggle-btn');
  const statusText = document.getElementById('polling-status-text');
  if (!btn) return;

  if (enabled) {
    btn.innerHTML = '<i class="fas fa-satellite-dish"></i> 🟢 Live Polling is ON — Click to turn OFF';
    btn.style.background = 'rgba(34,197,94,0.15)';
    btn.style.borderColor = '#22c55e';
    btn.style.color = '#22c55e';
    btn.style.border = '2px solid #22c55e';
    if (statusText) statusText.textContent = 'Dashboard will auto-fetch results from football-data.org every 5 minutes for all users.';
  } else {
    btn.innerHTML = '<i class="fas fa-satellite-dish"></i> 🔴 Live Polling is OFF — Click to turn ON';
    btn.style.background = 'rgba(239,68,68,0.15)';
    btn.style.borderColor = '#ef4444';
    btn.style.color = '#ef4444';
    btn.style.border = '2px solid #ef4444';
    if (statusText) statusText.textContent = 'Polling is OFF — safe to run simulations. Turn ON when real tournament is live.';
  }
}

async function togglePolling() {
  const statusDiv = document.getElementById('polling-status');
  const btn = document.getElementById('polling-toggle-btn');
  if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

  try {
    const response = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_polling', admin_pin: ADMIN_PIN })
    });
    const data = await response.json();

    if (response.ok) {
      renderPollingButton(data.polling_enabled);
      if (statusDiv) {
        statusDiv.innerHTML = `<p style="color:${data.polling_enabled ? '#22c55e' : '#ef4444'};">
          <i class="fas fa-check-circle"></i> Polling is now <strong>${data.polling_enabled ? 'ON' : 'OFF'}</strong>.
          ${data.polling_enabled ? 'All users will receive live result updates every 5 minutes.' : 'No API calls will be made. Safe to test and simulate.'}
        </p>`;
      }
    } else {
      if (statusDiv) statusDiv.innerHTML = `<p style="color:var(--accent-red);">Error: ${data.error}</p>`;
      loadPollingStatus(); // restore button state
    }
  } catch (e) {
    if (statusDiv) statusDiv.innerHTML = `<p style="color:var(--accent-red);">Error: ${e.message}</p>`;
    loadPollingStatus();
  }
}

// ─── DATA EXPORT ─────────────────────────────────────────────────────────────

async function downloadPicksCSV() {
  const btn = document.getElementById('download-picks-btn');
  if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...'; btn.disabled = true; }

  try {
    // Fetch all picks with user and team data
    const [picksRes, leaderboardRes] = await Promise.all([
      fetch('/api/picks?admin=true'),
      fetch('/api/leaderboard')
    ]);

    const picksData = await picksRes.json();
    const lbData = await leaderboardRes.json();

    const picks = picksData.picks || [];
    const leaderboard = lbData.leaderboard || [];

    // ── Sheet 1: All Picks ──
    let csvPicks = 'Player,Round,Matchday,Team,Result,Points,Submitted\n';
    picks.forEach(p => {
      const name = `"${p.users?.display_name || p.users?.username || 'Unknown'}"`;
      const round = `"${p.rounds?.name || ''}"`;
      const md = p.matchday || '-';
      const team = `"${p.teams?.name || ''}"`;
      const result = p.result || 'pending';
      const points = p.points || 0;
      const date = new Date(p.created_at).toLocaleDateString('en-GB');
      csvPicks += `${name},${round},${md},${team},${result},${points},${date}\n`;
    });

    // ── Sheet 2: Leaderboard Summary ──
    let csvLB = 'Position,Player,Total Points,Wins,Status\n';
    leaderboard.forEach(p => {
      csvLB += `${p.position},"${p.display_name || p.username}",${p.total_points},${p.wins},${p.status}\n`;
    });

    // ── Sheet 3: Per-user round summary ──
    let csvSummary = 'Player,GS Points,R32 Points,R16 Points,QF Points,SF Points,Final Points,Total\n';
    leaderboard.forEach(p => {
      const gs  = (p.picks_by_round?.GS  || []).reduce((s, pk) => s + (pk.points || 0), 0);
      const l32 = (p.picks_by_round?.L32 || []).reduce((s, pk) => s + (pk.points || 0), 0);
      const l16 = (p.picks_by_round?.L16 || []).reduce((s, pk) => s + (pk.points || 0), 0);
      const qf  = (p.picks_by_round?.QF  || []).reduce((s, pk) => s + (pk.points || 0), 0);
      const sf  = (p.picks_by_round?.SF  || []).reduce((s, pk) => s + (pk.points || 0), 0);
      const f   = (p.picks_by_round?.F   || []).reduce((s, pk) => s + (pk.points || 0), 0);
      csvSummary += `"${p.display_name || p.username}",${gs},${l32},${l16},${qf},${sf},${f},${p.total_points}\n`;
    });

    // Download all 3 as separate files
    const now = new Date().toLocaleDateString('en-GB').replace(/\//g,'-');
    downloadCSV(csvPicks,    `wc-all-picks-${now}.csv`);
    setTimeout(() => downloadCSV(csvLB,      `wc-leaderboard-${now}.csv`), 300);
    setTimeout(() => downloadCSV(csvSummary, `wc-round-summary-${now}.csv`), 600);

  } catch (e) {
    alert('Error generating CSV: ' + e.message);
  } finally {
    if (btn) { btn.innerHTML = '<i class="fas fa-download"></i> Download All Data (CSV)'; btn.disabled = false; }
  }
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── PLAYER PICKS OVERVIEW ───────────────────────────────────────────────────

async function loadPlayerOverview() {
  const container = document.getElementById('player-overview');
  container.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading...</p>';

  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    const players = data.leaderboard || [];

    if (players.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary);">No players yet.</p>';
      return;
    }

    const roundOrder = ['GS', 'L32', 'L16', 'QF', 'SF', 'F'];
    const roundLabels = { GS: 'Group Stage', L32: 'Round of 32', L16: 'Round of 16', QF: 'Quarter Finals', SF: 'Semi Finals', F: 'Final' };

    let html = `<div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
        <thead>
          <tr style="background:var(--bg-secondary);border-bottom:2px solid var(--border-color);">
            <th style="padding:0.5rem 0.75rem;text-align:left;">#</th>
            <th style="padding:0.5rem 0.75rem;text-align:left;">Player</th>
            <th style="padding:0.5rem 0.75rem;text-align:center;">Pts</th>
            <th style="padding:0.5rem 0.75rem;text-align:left;">Group Stage (MD1 / MD2 / MD3)</th>
            <th style="padding:0.5rem 0.75rem;text-align:left;">R32</th>
            <th style="padding:0.5rem 0.75rem;text-align:left;">R16</th>
            <th style="padding:0.5rem 0.75rem;text-align:left;">QF</th>
            <th style="padding:0.5rem 0.75rem;text-align:left;">SF</th>
            <th style="padding:0.5rem 0.75rem;text-align:left;">Final</th>
          </tr>
        </thead>
        <tbody>`;

    players.forEach(p => {
      const gs = p.picks_by_round?.GS || [];
      
      // Group GS picks by matchday
      const md1 = gs.filter(pk => pk.matchday === 1);
      const md2 = gs.filter(pk => pk.matchday === 2);
      const md3 = gs.filter(pk => pk.matchday === 3);

      // If matchday not available fall back to order
      const gsByMd = gs.length > 0 && gs[0].matchday 
        ? [md1, md2, md3]
        : [gs.slice(0,3), gs.slice(3,6), gs.slice(6,9)];

      function pickCell(picks) {
        if (!picks || picks.length === 0) return '<span style="color:var(--text-secondary);font-size:0.75rem;">—</span>';
        return picks.map(pk => {
          const col = pk.result === 'win' ? '#22c55e' : pk.result === 'loss' ? '#ef4444' : '#8b92b9';
          const icon = pk.result === 'win' ? '✓' : pk.result === 'loss' ? '✗' : '?';
          return `<span style="color:${col};white-space:nowrap;">${icon} ${pk.team || ''}${pk.points > 0 ? ` +${pk.points}` : ''}</span>`;
        }).join('<br>');
      }

      function koCell(roundKey) {
        const picks = p.picks_by_round?.[roundKey] || [];
        return pickCell(picks);
      }

      const gsCell = `<td style="padding:0.4rem 0.75rem;border-bottom:1px solid var(--border-color);vertical-align:top;">
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
          <div><div style="font-size:0.65rem;color:var(--accent-gold);margin-bottom:2px;">MD1</div>${pickCell(gsByMd[0])}</div>
          <div><div style="font-size:0.65rem;color:var(--accent-gold);margin-bottom:2px;">MD2</div>${pickCell(gsByMd[1])}</div>
          <div><div style="font-size:0.65rem;color:var(--accent-gold);margin-bottom:2px;">MD3</div>${pickCell(gsByMd[2])}</div>
        </div>
      </td>`;

      const statusCol = p.status === 'eliminated' ? '#ef4444' : '#22c55e';

      html += `<tr style="border-bottom:1px solid var(--border-color);">
        <td style="padding:0.4rem 0.75rem;color:var(--text-secondary);">${p.position}</td>
        <td style="padding:0.4rem 0.75rem;font-weight:600;">
          ${p.display_name || p.username}
          <span style="font-size:0.65rem;color:${statusCol};margin-left:4px;">${p.status}</span>
        </td>
        <td style="padding:0.4rem 0.75rem;text-align:center;font-weight:700;color:var(--accent-gold);">${p.total_points}</td>
        ${gsCell}
        <td style="padding:0.4rem 0.75rem;border-bottom:1px solid var(--border-color);vertical-align:top;">${koCell('L32')}</td>
        <td style="padding:0.4rem 0.75rem;border-bottom:1px solid var(--border-color);vertical-align:top;">${koCell('L16')}</td>
        <td style="padding:0.4rem 0.75rem;border-bottom:1px solid var(--border-color);vertical-align:top;">${koCell('QF')}</td>
        <td style="padding:0.4rem 0.75rem;border-bottom:1px solid var(--border-color);vertical-align:top;">${koCell('SF')}</td>
        <td style="padding:0.4rem 0.75rem;border-bottom:1px solid var(--border-color);vertical-align:top;">${koCell('F')}</td>
      </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

  } catch (e) {
    container.innerHTML = `<p style="color:var(--accent-red);">Error: ${e.message}</p>`;
  }
}

// ─── FULL TOURNAMENT DATA EXPORT ─────────────────────────────────────────────

async function downloadFullTournamentCSV() {
  const btn = document.getElementById('download-full-btn');
  if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...'; btn.disabled = true; }

  try {
    const [picksRes, lbRes, entriesRes] = await Promise.all([
      fetch('/api/picks?admin=true'),
      fetch('/api/leaderboard'),
      fetch('/api/entries?admin=true')
    ]);

    const picksData = await picksRes.json();
    const lbData = await lbRes.json();

    const allPicks = picksData.picks || [];
    const players = lbData.leaderboard || [];

    // Build headers
    const headers = [
      'Player Name',
      'Entry Date',
      'Status',
      'Total Points',
      // Group Stage MD1
      'GS MD1 Pick 1', 'GS MD1 P1 Result', 'GS MD1 P1 Pts',
      'GS MD1 Pick 2', 'GS MD1 P2 Result', 'GS MD1 P2 Pts',
      'GS MD1 Pick 3', 'GS MD1 P3 Result', 'GS MD1 P3 Pts',
      // Group Stage MD2
      'GS MD2 Pick 1', 'GS MD2 P1 Result', 'GS MD2 P1 Pts',
      'GS MD2 Pick 2', 'GS MD2 P2 Result', 'GS MD2 P2 Pts',
      'GS MD2 Pick 3', 'GS MD2 P3 Result', 'GS MD2 P3 Pts',
      // Group Stage MD3
      'GS MD3 Pick 1', 'GS MD3 P1 Result', 'GS MD3 P1 Pts',
      'GS MD3 Pick 2', 'GS MD3 P2 Result', 'GS MD3 P2 Pts',
      'GS MD3 Pick 3', 'GS MD3 P3 Result', 'GS MD3 P3 Pts',
      'GS Total Points',
      // Knockout rounds
      'R32 Pick', 'R32 Result', 'R32 Pts', 'R32 Note',
      'R16 Pick', 'R16 Result', 'R16 Pts', 'R16 Note',
      'QF Pick',  'QF Result',  'QF Pts', 'QF Score Prediction', 'QF Score Bonus',
      'SF Pick',  'SF Result',  'SF Pts', 'SF Score Prediction', 'SF Score Bonus',
      'Final Pick', 'Final Result', 'Final Pts', 'Final Score Prediction', 'Final Score Bonus',
      'Went Out Round'
    ];

    const rows = [headers];

    players.forEach(player => {
      // Get all picks for this player from allPicks (has matchday data)
      const playerPicks = allPicks.filter(p =>
        (p.users?.display_name || p.users?.username) === (player.display_name || player.username)
      );

      // Group stage picks by matchday
      const gsPicks = playerPicks.filter(p => p.rounds?.round_number === 1);
      const md1 = gsPicks.filter(p => p.matchday === 1).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
      const md2 = gsPicks.filter(p => p.matchday === 2).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
      const md3 = gsPicks.filter(p => p.matchday === 3).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

      // Knockout picks
      const r32 = playerPicks.find(p => p.rounds?.round_number === 2);
      const r16 = playerPicks.find(p => p.rounds?.round_number === 3);
      const qf  = playerPicks.find(p => p.rounds?.round_number === 4);
      const sf  = playerPicks.find(p => p.rounds?.round_number === 5);
      const fin = playerPicks.find(p => p.rounds?.round_number === 6);

      // Helper to get pick fields
      const pickCol = (pick) => pick
        ? [pick.teams?.name || '', pick.result || 'pending', pick.points || 0]
        : ['—', '—', 0];

      // Helper for QF/SF/Final — includes score prediction and bonus
      const scorePickCol = (pick) => {
        if (!pick) return ['—', '—', 0, '—', 0];
        const prediction = (pick.predicted_home_score !== null && pick.predicted_home_score !== undefined)
          ? `${pick.predicted_home_score}-${pick.predicted_away_score}`
          : '—';
        return [
          pick.teams?.name || '',
          pick.result || 'pending',
          pick.points || 0,
          prediction,
          pick.score_bonus || 0
        ];
      };

      // MD pick cols (3 picks per matchday, pad with blanks if fewer)
      const mdCols = (picks) => {
        const out = [];
        for (let i = 0; i < 3; i++) {
          out.push(...pickCol(picks[i]));
        }
        return out;
      };

      // GS total
      const gsTotal = [...md1,...md2,...md3].reduce((s,p) => s + (p.points || 0), 0);

      // Knockout note for R32/R16
      const koNote = (pick, roundNum) => {
        if (pick) return '';
        const roundPicks = allPicks.filter(p => p.rounds?.round_number === roundNum);
        if (roundPicks.length === 0) return 'Round not yet played';
        return 'No eligible teams available';
      };

      // Work out which round they went out
      let wentOut = '';
      if (fin && fin.result === 'loss') wentOut = 'Final';
      else if (sf && sf.result === 'loss') wentOut = 'Semi Finals';
      else if (qf && qf.result === 'loss') wentOut = 'Quarter Finals';
      else if (r16 && r16.result === 'loss') wentOut = 'Round of 16';
      else if (r32 && r32.result === 'loss') wentOut = 'Round of 32';
      else if (!r32 && allPicks.some(p => p.rounds?.round_number === 2)) wentOut = 'No R32 pick — out';
      else if (player.status === 'eliminated') wentOut = 'Eliminated';
      else wentOut = 'Still active';

      const entryDate = player.entered_at
        ? new Date(player.entered_at).toLocaleDateString('en-GB')
        : '—';

      const row = [
        player.display_name || player.username,
        entryDate,
        player.status || 'active',
        player.total_points || 0,
        ...mdCols(md1),
        ...mdCols(md2),
        ...mdCols(md3),
        gsTotal,
        ...pickCol(r32), koNote(r32, 2),
        ...pickCol(r16), koNote(r16, 3),
        ...scorePickCol(qf),
        ...scorePickCol(sf),
        ...scorePickCol(fin),
        wentOut
      ];

      // Wrap any field with commas in quotes
      rows.push(row.map(v => {
        const s = String(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s;
      }));
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    const now = new Date().toLocaleDateString('en-GB').replace(/\//g,'-');
    downloadCSV(csv, `wc-full-tournament-data-${now}.csv`);

  } catch(e) {
    alert('Error: ' + e.message);
  } finally {
    if (btn) { btn.innerHTML = '<i class="fas fa-download"></i> Download Full Tournament Data (CSV)'; btn.disabled = false; }
  }
}
// ─── SNAPSHOT SYSTEM ─────────────────────────────────────────────────────────

async function createSnapshot() {
  const label = document.getElementById('snapshot-label')?.value?.trim() 
    || `Snapshot ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}`;
  const statusDiv = document.getElementById('snapshot-status');
  statusDiv.innerHTML = '<p style="color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Creating snapshot...</p>';

  try {
    const res = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_snapshot', label, admin_pin: ADMIN_PIN })
    });
    const data = await res.json();
    if (res.ok) {
      statusDiv.innerHTML = `
        <p style="color:var(--accent-green);">
          <i class="fas fa-check-circle"></i> Snapshot created: <strong>${label}</strong><br>
          <small style="color:var(--text-secondary);">
            ${data.counts.picks} picks · ${data.counts.matches} matches · ${data.counts.rounds} rounds · ${data.counts.entries} entries
          </small>
        </p>`;
      document.getElementById('snapshot-label').value = '';
      loadSnapshots();
    } else {
      statusDiv.innerHTML = `<p style="color:var(--accent-red);">Error: ${data.error}</p>`;
    }
  } catch (e) {
    statusDiv.innerHTML = `<p style="color:var(--accent-red);">Error: ${e.message}</p>`;
  }
}

async function loadSnapshots() {
  const container = document.getElementById('snapshot-list');
  container.innerHTML = '<p style="color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading...</p>';

  try {
    const res = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_snapshots', admin_pin: ADMIN_PIN })
    });
    const data = await res.json();

    if (!res.ok) { container.innerHTML = `<p style="color:var(--accent-red);">Error: ${data.error}</p>`; return; }

    const snapshots = data.snapshots || [];
    if (snapshots.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary);font-style:italic;">No snapshots yet.</p>';
      return;
    }

    container.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:0.83rem;">
        <thead>
          <tr style="border-bottom:1px solid var(--border-color);">
            <th style="padding:0.5rem;text-align:left;color:var(--text-secondary);">Name</th>
            <th style="padding:0.5rem;text-align:left;color:var(--text-secondary);">Created</th>
            <th style="padding:0.5rem;text-align:right;color:var(--text-secondary);">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${snapshots.map(s => {
            const date = new Date(s.created_at).toLocaleString('en-GB', { 
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' 
            });
            return `
              <tr style="border-bottom:1px solid var(--border-color);">
                <td style="padding:0.5rem;font-weight:500;">${s.label}</td>
                <td style="padding:0.5rem;color:var(--text-secondary);">${date}</td>
                <td style="padding:0.5rem;text-align:right;">
                  <button onclick="restoreSnapshot('${s.id}', '${s.label.replace(/'/g,"\\'")}') "
                    style="background:rgba(239,68,68,0.15);border:1px solid #ef4444;color:#ef4444;padding:0.3rem 0.75rem;border-radius:0.4rem;font-size:0.75rem;cursor:pointer;margin-right:0.25rem;">
                    <i class="fas fa-undo"></i> Restore
                  </button>
                  <button onclick="deleteSnapshot('${s.id}')"
                    style="background:transparent;border:1px solid var(--border-color);color:var(--text-secondary);padding:0.3rem 0.5rem;border-radius:0.4rem;font-size:0.75rem;cursor:pointer;">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    container.innerHTML = `<p style="color:var(--accent-red);">Error: ${e.message}</p>`;
  }
}

async function restoreSnapshot(snapshotId, label) {
  if (!confirm(`⚠️ RESTORE SNAPSHOT\n\n"${label}"\n\nThis will OVERWRITE all current tournament data with this snapshot.\n\nAre you absolutely sure?`)) return;
  if (!confirm(`Second confirmation: restore "${label}"?\n\nAll current data will be lost.`)) return;

  const statusDiv = document.getElementById('snapshot-status');
  statusDiv.innerHTML = '<p style="color:var(--accent-gold);"><i class="fas fa-spinner fa-spin"></i> Restoring snapshot... please wait...</p>';

  try {
    const res = await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore_snapshot', snapshot_id: snapshotId, admin_pin: ADMIN_PIN })
    });
    const data = await res.json();
    if (res.ok) {
      statusDiv.innerHTML = `
        <p style="color:var(--accent-green);">
          <i class="fas fa-check-circle"></i> <strong>Restored successfully!</strong><br>
          <small style="color:var(--text-secondary);">
            ${data.restored.picks} picks · ${data.restored.matches} matches · 
            ${data.restored.rounds} rounds · ${data.restored.entries} entries restored
          </small>
        </p>`;
    } else {
      statusDiv.innerHTML = `<p style="color:var(--accent-red);">Restore failed: ${data.error}</p>`;
    }
  } catch (e) {
    statusDiv.innerHTML = `<p style="color:var(--accent-red);">Error: ${e.message}</p>`;
  }
}

async function deleteSnapshot(snapshotId) {
  if (!confirm('Delete this snapshot? This cannot be undone.')) return;
  try {
    await fetch('/api/reset-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_snapshot', snapshot_id: snapshotId, admin_pin: ADMIN_PIN })
    });
    loadSnapshots();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}