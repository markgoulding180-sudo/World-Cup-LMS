// Dashboard page JavaScript - v3: Multi-select pick flow (pick 3, then submit)

let currentMatchday = 1;
let allMatches = [];
let allTeams = [];
let userPicks = [];
let roundPicks = [];
let currentRound = null;
let tournamentId = null;
let selectedTeams = []; // Track selected teams for current matchday

async function loadDashboard() {
  const token = localStorage.getItem('wc_lms_token');
  
  try {
    const statusResponse = await fetch('/api/entries', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    // Handle auth errors
    if (statusResponse.status === 401) {
      localStorage.removeItem('wc_lms_token');
      window.location.href = '/login.html';
      return;
    }
    
    let statusData = {};
    if (statusResponse.ok) {
      statusData = await statusResponse.json();
      updateStatusCard(statusData);
    }
    
    let roundsData = null;
    const roundsResponse = await fetch('/api/rounds');
    if (roundsResponse.ok) {
      roundsData = await roundsResponse.json();
      currentRound = roundsData.rounds?.find(r => r.status === 'open') || roundsData.rounds?.[0];
    }
    
    const tourneyResponse = await fetch('/api/tournaments');
    if (tourneyResponse.ok) {
      const tourneyData = await tourneyResponse.json();
      tournamentId = tourneyData.tournaments?.[0]?.id;
    }
    
    const picksResponse = await fetch('/api/picks', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (picksResponse.ok) {
      const picksData = await picksResponse.json();
      userPicks = picksData.picks || [];
      roundPicks = currentRound ? userPicks.filter(p => p.round_id === currentRound.id) : [];
    }
    
    determineCurrentMatchday();
    
    const teamsResponse = await fetch('/api/teams');
    const matchesResponse = await fetch('/api/matches?limit=200');
    
    if (teamsResponse.ok && matchesResponse.ok) {
      const teamsData = await teamsResponse.json();
      const matchesData = await matchesResponse.json();
      
      allTeams = teamsData.teams || [];
      allMatches = matchesData.matches || [];
      
      // Check if there's no open round (waiting between rounds)
      const openRound = roundsData.rounds?.find(r => r.status === 'open');
      
      if (!openRound) {
        // No open round - show waiting message
        displayWaitingState();
      } else if (openRound.round_number >= 2) {
        // Knockout round - check if matches exist
        const roundMatches = allMatches.filter(m => m.round_id === openRound.id);
        if (roundMatches.length === 0) {
          displayKnockoutWaitingState(openRound);
        } else {
          currentRound = openRound;
          
          // Check if user has any eligible teams in this round
          const usedTeamIds = new Set(userPicks.map(p => p.team_id));
          const roundTeamIds = new Set();
          roundMatches.forEach(m => {
            roundTeamIds.add(m.home_team_id);
            roundTeamIds.add(m.away_team_id);
          });
          
          // Check if there are any teams in this round that user hasn't used
          const hasEligibleTeams = Array.from(roundTeamIds).some(teamId => !usedTeamIds.has(teamId));
          
          if (!hasEligibleTeams) {
            displayEliminatedState(openRound);
          } else {
            displayKnockoutPickFlow();
          }
        }
      } else {
        displayMatchdayPickFlow();
      }
      
      displayCurrentPicks(roundPicks);
      displayRoundMatches(allMatches, currentRound);
      displayTournamentHistory();
    }
    
  } catch (error) {
    console.error('Dashboard error:', error);
    document.getElementById('player-status').innerHTML = '<p class="error">Error loading dashboard</p>';
  }
}

function determineCurrentMatchday() {
  const matchdayCounts = { 1: 0, 2: 0, 3: 0 };
  roundPicks.forEach(pick => {
    if (pick.matchday && matchdayCounts[pick.matchday] !== undefined) {
      matchdayCounts[pick.matchday]++;
    }
  });
  
  if (matchdayCounts[1] < 3) {
    currentMatchday = 1;
  } else if (matchdayCounts[2] < 3) {
    currentMatchday = 2;
  } else if (matchdayCounts[3] < 3) {
    currentMatchday = 3;
  } else {
    currentMatchday = 4;
  }
  
  // Reset selected teams when switching matchdays
  selectedTeams = [];
}

function displayWaitingState() {
  const container = document.getElementById('available-teams');
  container.innerHTML = `
    <div class="waiting-state" style="text-align: center; padding: 3rem 1rem;">
      <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
      <h2 style="margin-bottom: 0.5rem;">Waiting for Next Round</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">
        The Group Stage has finished.<br>
        Waiting for the Round of 32 to begin.
      </p>
      <p style="font-size: 0.85rem; color: var(--text-secondary);">
        <i class="fas fa-info-circle"></i> 
        FIFA will announce the knockout fixtures after the group stage completes.
      </p>
    </div>
  `;
}

async function displayKnockoutWaitingState(round) {
  const container = document.getElementById('available-teams');
  const roundNames = { 2: 'Round of 32', 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
  
  // For R32, show qualified teams from group stage
  if (round.round_number === 2) {
    try {
      const response = await fetch('/api/matches?qualified=true');
      const data = await response.json();
      
      if (data.qualified && data.qualified.length > 0) {
        const teamsHtml = data.qualified.map(team => `
          <div class="qualified-team" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 0.75rem;
            background: rgba(255,255,255,0.05);
            border-radius: 0.5rem;
            border: 1px solid var(--border-color);
          ">
            <img src="${team.flag_url}" alt="${team.name}" style="width: 40px; height: 28px; object-fit: cover; border-radius: 0.25rem; margin-bottom: 0.5rem;">
            <span style="font-size: 0.75rem; font-weight: 600; text-align: center;">${team.name}</span>
            <span style="font-size: 0.65rem; color: var(--text-secondary);">${team.group_name} ${team.position}</span>
          </div>
        `).join('');
        
        container.innerHTML = `
          <div class="knockout-waiting" style="text-align: center; padding: 2rem 1rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
            <h2 style="margin-bottom: 0.5rem;">${roundNames[round.round_number]} - Waiting for Draw</h2>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
              FIFA will announce the ${roundNames[round.round_number]} fixtures soon.
              <br>Check back after the Group Stage completes.
            </p>
            
            <div style="margin: 1.5rem 0;">
              <h3 style="font-size: 1rem; margin-bottom: 1rem;">Teams Qualified (${data.qualified.length}/32)</h3>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 0.75rem;">
                ${teamsHtml}
              </div>
            </div>
            
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 1.5rem;">
              <i class="fas fa-info-circle"></i> 
              Top 2 from each group + 8 best third-placed teams advance
            </p>
          </div>
        `;
        return;
      }
    } catch (e) {
      console.log('Could not load qualified teams:', e);
    }
  }
  
  // Default waiting message for other rounds or if qualified teams fail to load
  container.innerHTML = `
    <div class="knockout-waiting" style="text-align: center; padding: 3rem 1rem;">
      <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
      <h2 style="margin-bottom: 0.5rem;">${roundNames[round.round_number]} - Coming Soon</h2>
      <p style="color: var(--text-secondary);">
        The ${roundNames[round.round_number]} fixtures will be available once the previous round completes.
        <br>Check back soon!
      </p>
    </div>
  `;
}

function displayEliminatedState(round) {
  const container = document.getElementById('available-teams');
  const roundNames = { 2: 'Round of 32', 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
  const roundName = roundNames[round.round_number] || round.name;
  
  container.innerHTML = `
    <div class="eliminated-state" style="text-align: center; padding: 2rem 1rem; background: rgba(239, 68, 68, 0.1); border: 2px solid var(--accent-red); border-radius: 1rem;">
      <div style="font-size: 3rem; margin-bottom: 1rem;">😔</div>
      <h2 style="margin-bottom: 0.5rem; color: var(--accent-red);">You're Out!</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">
        Sorry, you have no eligible teams left in the World Cup.
      </p>
      <p style="color: var(--text-secondary); font-size: 0.9rem;">
        All the teams you picked earlier have been eliminated or you've already used all remaining teams.
        <br><br>
        <strong>Thanks for playing!</strong>
      </p>
      <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
        <p style="color: var(--text-secondary); font-size: 0.8rem;">
          Check the leaderboard to see your final position.
        </p>
      </div>
    </div>
  `;
}

function displayKnockoutPickFlow() {
  const container = document.getElementById('available-teams');
  
  if (!currentRound) {
    container.innerHTML = '<p class="text-secondary">No active round available.</p>';
    return;
  }
  
  const statusDiv = document.getElementById('player-status');
  const isEntered = statusDiv && !statusDiv.querySelector('.not-entered');
  
  if (!isEntered) {
    container.innerHTML = `
      <div class="not-entered-message">
        <p>You need to enter the tournament before making picks.</p>
        <button class="btn btn-primary" onclick="enterTournament()">
          <i class="fas fa-ticket-alt"></i> Enter Tournament (£30)
        </button>
      </div>
    `;
    return;
  }
  
  // Check if user already has a pick for this round
  const existingPick = roundPicks.find(p => p.round_id === currentRound.id);
  if (existingPick) {
    const team = allTeams.find(t => t.id === existingPick.team_id);
    const result = existingPick.result || 'pending';
    const points = existingPick.points || 0;
    
    // Determine result display
    let resultHtml = '';
    if (result === 'win') {
      resultHtml = `<div class="pick-result-display win"><i class="fas fa-trophy"></i> WIN! +${points} points</div>`;
    } else if (result === 'loss') {
      resultHtml = `<div class="pick-result-display loss"><i class="fas fa-times-circle"></i> Lost</div>`;
    } else {
      resultHtml = `<div class="pick-result-display pending"><i class="fas fa-clock"></i> Pending</div>`;
    }
    
    container.innerHTML = `
      <div class="pick-submitted ${result}">
        <i class="fas fa-check-circle"></i>
        <h3>Pick Submitted!</h3>
        <div class="submitted-pick-display">
          <img src="${team?.flag_url || ''}" alt="${team?.name}" class="submitted-flag">
          <span class="submitted-team-name">${team?.name || existingPick.teams?.name}</span>
        </div>
        ${resultHtml}
        <p class="submitted-round">${currentRound.name}</p>
      </div>
    `;
    return;
  }
  
  // Get matches for this round
  const roundMatches = allMatches.filter(m => m.round_id === currentRound.id);
  
  if (roundMatches.length === 0) {
    container.innerHTML = `<p class="text-secondary">No matches found for ${currentRound.name}.</p>`;
    return;
  }
  
  // Get all teams playing in this round
  const roundTeamIds = new Set();
  roundMatches.forEach(m => {
    roundTeamIds.add(m.home_team_id);
    roundTeamIds.add(m.away_team_id);
  });
  
  const roundTeams = allTeams.filter(t => roundTeamIds.has(t.id));
  
  // Get all teams already used by this user in ANY round
  const usedTeamIds = new Set(userPicks.map(p => p.team_id));
  
  // Check if any used teams are still in this round
  const usedTeamsInRound = roundTeams.filter(t => usedTeamIds.has(t.id));
  
  const roundNames = { 2: 'Round of 32', 3: 'Round of 16', 4: 'Quarter Finals', 5: 'Semi Finals', 6: 'Final' };
  const roundName = roundNames[currentRound.round_number] || currentRound.name;
  
  // Build warning banner for used teams still in tournament
  let warningBanner = '';
  if (usedTeamsInRound.length > 0) {
    const teamNames = usedTeamsInRound.map(t => t.name).join(', ');
    warningBanner = `
      <div class="used-teams-warning">
        <i class="fas fa-exclamation-triangle"></i>
        <strong>You already used:</strong> ${teamNames}
        <br><small>These teams are still in the tournament but you cannot pick them again</small>
      </div>
    `;
  }
  
  let html = `
    <div class="knockout-pick-flow">
      <div class="knockout-header">
        <h3>${roundName}</h3>
        <p class="knockout-instruction">Pick <strong>ONE</strong> team to win their match</p>
        ${warningBanner}
        <p class="used-teams-note"><i class="fas fa-info-circle"></i> Teams greyed out were used in previous rounds</p>
      </div>
      
      <div class="knockout-matches">
  `;
  
  roundMatches.forEach(m => {
    const matchDate = new Date(m.match_time);
    const dateStr = matchDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    const homeTeam = allTeams.find(t => t.id === m.home_team_id);
    const awayTeam = allTeams.find(t => t.id === m.away_team_id);
    
    const homeUsed = usedTeamIds.has(m.home_team_id);
    const awayUsed = usedTeamIds.has(m.away_team_id);
    
    html += `
      <div class="knockout-match-card">
        <div class="match-header">
          <span class="match-date">${dateStr} @ ${timeStr}</span>
        </div>
        <div class="match-teams">
          <div class="match-team ${homeUsed ? 'used' : ''}" ${homeUsed ? '' : `onclick="submitKnockoutPick('${m.home_team_id}')"`}>
            <img src="${homeTeam?.flag_url || ''}" alt="${homeTeam?.name}" class="team-flag">
            <span class="team-name">${homeTeam?.name || 'TBD'}</span>
            ${homeUsed ? '<span class="used-badge"><i class="fas fa-ban"></i> Used</span>' : '<button class="pick-btn">Pick</button>'}
          </div>
          <span class="match-vs">VS</span>
          <div class="match-team ${awayUsed ? 'used' : ''}" ${awayUsed ? '' : `onclick="submitKnockoutPick('${m.away_team_id}')"`}>
            <img src="${awayTeam?.flag_url || ''}" alt="${awayTeam?.name}" class="team-flag">
            <span class="team-name">${awayTeam?.name || 'TBD'}</span>
            ${awayUsed ? '<span class="used-badge"><i class="fas fa-ban"></i> Used</span>' : '<button class="pick-btn">Pick</button>'}
          </div>
        </div>
      </div>
    `;
  });
  
  html += `
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

async function submitKnockoutPick(teamId) {
  const token = localStorage.getItem('wc_lms_token');
  const team = allTeams.find(t => t.id === teamId);
  
  if (!confirm(`Pick ${team?.name} for the ${currentRound.name}?`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/picks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        team_id: teamId,
        round_id: currentRound.id,
        tournament_id: tournamentId,
        matchday: null  // Knockout rounds don't use matchdays
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      alert(`✓ Pick submitted! You picked ${team?.name}`);
      
      // Update local state instead of reloading everything
      if (data.pick) {
        roundPicks.push(data.pick);
        userPicks.push(data.pick);
      }
      
      // Just re-render the pick flow
      displayKnockoutPickFlow();
      displayCurrentPicks(roundPicks);
    } else {
      const error = await response.json();
      alert('Error: ' + (error.error || 'Failed to submit pick'));
    }
  } catch (error) {
    alert('Error submitting pick: ' + error.message);
  }
}

function displayMatchdayPickFlow() {
  const container = document.getElementById('available-teams');
  
  if (!currentRound) {
    container.innerHTML = '<p class="text-secondary">No active round available.</p>';
    return;
  }
  
  const statusDiv = document.getElementById('player-status');
  const isEntered = statusDiv && !statusDiv.querySelector('.not-entered');
  
  if (!isEntered) {
    container.innerHTML = `
      <div class="not-entered-message">
        <p>You need to enter the tournament before making picks.</p>
        <button class="btn btn-primary" onclick="enterTournament()">
          <i class="fas fa-ticket-alt"></i> Enter Tournament (£30)
        </button>
      </div>
    `;
    return;
  }
  
  if (currentMatchday > 3) {
    container.innerHTML = `
      <div class="all-picks-complete">
        <i class="fas fa-check-circle"></i>
        <h3>All Picks Submitted!</h3>
        <p>You have made all 9 picks for the Group Stage (3 per matchday).</p>
        <p>Good luck!</p>
      </div>
    `;
    return;
  }
  
  const matchdayMatches = allMatches.filter(m => 
    m.round_id === currentRound.id && m.matchday === currentMatchday
  );
  
  if (matchdayMatches.length === 0) {
    container.innerHTML = `<p class="text-secondary">No matches found for Matchday ${currentMatchday}.</p>`;
    return;
  }
  
  const matchdayTeamIds = new Set();
  matchdayMatches.forEach(m => {
    matchdayTeamIds.add(m.home_team_id);
    matchdayTeamIds.add(m.away_team_id);
  });
  
  const usedTeamIds = new Set(roundPicks.map(p => p.team_id));
  const availableMatchdayTeams = allTeams.filter(t => 
    matchdayTeamIds.has(t.id) && !usedTeamIds.has(t.id)
  );
  
  const picksInCurrentMatchday = roundPicks.filter(p => p.matchday === currentMatchday).length;
  const remainingPicks = 3 - picksInCurrentMatchday;
  
  let html = `
    <div class="matchday-flow">
      <div class="matchday-header">
        <h3>Matchday ${currentMatchday} of 3</h3>
        <div class="matchday-progress">
          <span class="picks-count">${picksInCurrentMatchday}</span>
          <span class="picks-total">/ 3 picks selected</span>
        </div>
      </div>
      
      <div class="matchday-progress-bar">
        <div class="progress-fill" style="width: ${(picksInCurrentMatchday / 3) * 100}%"></div>
      </div>
      
      <p class="matchday-instruction">
        Select <strong>${remainingPicks}</strong> teams below, then click Submit.
        <br><small>Each team can only be used once across all matchdays.</small>
      </p>
      
      <div class="selected-teams-preview" id="selected-preview" style="display: none;">
        <h4>Your Selections:</h4>
        <div id="selected-teams-list"></div>
        <button class="btn btn-primary btn-lg" onclick="submitMatchdayPicks()">
          <i class="fas fa-check"></i> Submit Matchday ${currentMatchday} Picks
        </button>
        <button class="btn btn-secondary" onclick="clearSelections()">
          <i class="fas fa-times"></i> Clear
        </button>
      </div>
  `;
  
  // Build match-based picker with team cards
  html += '<div class="match-picker-list">';
  
  matchdayMatches.forEach(m => {
    const matchDate = new Date(m.match_time);
    const dateStr = matchDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    const homeTeam = allTeams.find(t => t.id === m.home_team_id);
    const awayTeam = allTeams.find(t => t.id === m.away_team_id);
    
    const homePicked = roundPicks.some(p => p.team_id === m.home_team_id);
    const awayPicked = roundPicks.some(p => p.team_id === m.away_team_id);
    const homeSelected = selectedTeams.includes(m.home_team_id);
    const awaySelected = selectedTeams.includes(m.away_team_id);
    
    html += `
      <div class="match-picker-card">
        <div class="match-picker-header">
          <span class="match-picker-date">${dateStr} @ ${timeStr}</span>
          <span class="match-picker-group">Group ${homeTeam?.group_name || '?'}</span>
        </div>
        <div class="match-picker-teams">
          <div class="match-picker-team ${homePicked ? 'picked' : ''} ${homeSelected ? 'selected' : ''}" 
               onclick="${homePicked ? '' : `toggleTeamSelection('${m.home_team_id}')`}">
            <img src="${homeTeam?.flag_url || ''}" alt="${homeTeam?.name}" class="match-picker-flag">
            <span class="match-picker-team-name">${homeTeam?.name || 'TBD'}</span>
            ${homePicked ? '<i class="fas fa-check match-picker-status"></i>' : ''}
            ${homeSelected ? '<i class="fas fa-check-circle match-picker-status selected"></i>' : ''}
          </div>
          <span class="match-picker-vs">VS</span>
          <div class="match-picker-team ${awayPicked ? 'picked' : ''} ${awaySelected ? 'selected' : ''}"
               onclick="${awayPicked ? '' : `toggleTeamSelection('${m.away_team_id}')`}">
            <img src="${awayTeam?.flag_url || ''}" alt="${awayTeam?.name}" class="match-picker-flag">
            <span class="match-picker-team-name">${awayTeam?.name || 'TBD'}</span>
            ${awayPicked ? '<i class="fas fa-check match-picker-status"></i>' : ''}
            ${awaySelected ? '<i class="fas fa-check-circle match-picker-status selected"></i>' : ''}
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  html += `
    <div class="upcoming-matchdays">
      <h4>Your Progress</h4>
      <div class="matchday-status-list">
        <div class="matchday-status ${currentMatchday === 1 ? 'active' : (roundPicks.some(p => p.matchday === 1) ? 'complete' : '')}">
          <span class="status-dot"></span>
          <span class="status-label">Matchday 1</span>
          <span class="status-count">${roundPicks.filter(p => p.matchday === 1).length}/3</span>
        </div>
        <div class="matchday-status ${currentMatchday === 2 ? 'active' : (roundPicks.some(p => p.matchday === 2) ? 'complete' : '')}">
          <span class="status-dot"></span>
          <span class="status-label">Matchday 2</span>
          <span class="status-count">${roundPicks.filter(p => p.matchday === 2).length}/3</span>
        </div>
        <div class="matchday-status ${currentMatchday === 3 ? 'active' : (roundPicks.some(p => p.matchday === 3) ? 'complete' : '')}">
          <span class="status-dot"></span>
          <span class="status-label">Matchday 3</span>
          <span class="status-count">${roundPicks.filter(p => p.matchday === 3).length}/3</span>
        </div>
      </div>
    </div>
  `;
  
  html += '</div>';
  container.innerHTML = html;
  
  updateSelectedPreview();
}

function toggleTeamSelection(teamId) {
  const picksInMatchday = roundPicks.filter(p => p.matchday === currentMatchday).length;
  const maxSelectable = 3 - picksInMatchday;
  
  const index = selectedTeams.indexOf(teamId);
  
  if (index > -1) {
    // Deselect
    selectedTeams.splice(index, 1);
  } else {
    // Select (if under limit)
    if (selectedTeams.length < maxSelectable) {
      selectedTeams.push(teamId);
    } else {
      alert(`You can only select ${maxSelectable} team${maxSelectable !== 1 ? 's' : ''} for Matchday ${currentMatchday}`);
      return;
    }
  }
  
  displayMatchdayPickFlow();
}

function updateSelectedPreview() {
  const previewDiv = document.getElementById('selected-preview');
  const listDiv = document.getElementById('selected-teams-list');
  
  if (!previewDiv || !listDiv) return;
  
  if (selectedTeams.length === 0) {
    previewDiv.style.display = 'none';
    return;
  }
  
  previewDiv.style.display = 'block';
  
  const picksInMatchday = roundPicks.filter(p => p.matchday === currentMatchday).length;
  const needed = 3 - picksInMatchday;
  
  let html = '<div class="selected-teams-grid">';
  selectedTeams.forEach(teamId => {
    const team = allTeams.find(t => t.id === teamId);
    html += `
      <div class="selected-team-item">
        <img src="${team?.flag_url}" alt="" class="selected-flag">
        <span>${team?.name}</span>
      </div>
    `;
  });
  html += '</div>';
  
  if (selectedTeams.length < needed) {
    html += `<p class="selection-hint">Select ${needed - selectedTeams.length} more team${needed - selectedTeams.length !== 1 ? 's' : ''}</p>`;
  } else {
    // All 3 selected - scroll to Make Your Pick section to show submit button
    html += `<p class="selection-hint" style="color: var(--accent-green);"><i class="fas fa-check"></i> All 3 teams selected! Click Submit below.</p>`;
    setTimeout(() => {
      const pickSection = document.getElementById('pick-section');
      if (pickSection) {
        pickSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }
  
  listDiv.innerHTML = html;
}

function clearSelections() {
  selectedTeams = [];
  displayMatchdayPickFlow();
}

async function submitMatchdayPicks() {
  const token = localStorage.getItem('wc_lms_token');
  
  const picksInMatchday = roundPicks.filter(p => p.matchday === currentMatchday).length;
  const needed = 3 - picksInMatchday;
  
  if (selectedTeams.length < needed) {
    alert(`Please select ${needed} team${needed !== 1 ? 's' : ''} for Matchday ${currentMatchday}`);
    return;
  }
  
  const teamNames = selectedTeams.map(id => allTeams.find(t => t.id === id)?.name).join(', ');
  
  if (!confirm(`Submit these picks for Matchday ${currentMatchday}?\n\n${teamNames}`)) {
    return;
  }
  
  try {
    // Submit all picks
    const promises = selectedTeams.map(teamId => 
      fetch('/api/picks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          team_id: teamId,
          round_id: currentRound.id,
          tournament_id: tournamentId,
          matchday: currentMatchday
        })
      })
    );
    
    const responses = await Promise.all(promises);
    const allOk = responses.every(r => r.ok);
    
    if (allOk) {
      selectedTeams = []; // Clear selections
      
      // Update local state instead of reloading everything
      const newPicks = await Promise.all(responses.map(async r => await r.json()));
      newPicks.forEach(p => {
        if (p.pick) roundPicks.push(p.pick);
      });
      
      // Update current matchday based on picks made
      determineCurrentMatchday();
      
      if (currentMatchday < 3) {
        alert(`✓ Matchday ${currentMatchday - 1} complete!\n\nMoving to Matchday ${currentMatchday}...`);
      } else {
        alert(`✓ All picks submitted! Good luck!`);
      }
      
      // Just re-render the pick flow, don't reload all data
      displayMatchdayPickFlow();
      displayCurrentPicks(roundPicks);
    } else {
      alert('Some picks failed. Please try again.');
    }
  } catch (error) {
    alert('Error submitting picks: ' + error.message);
  }
}

function displayCurrentPicks(picks) {
  const container = document.getElementById('current-pick');
  if (!container) return;
  
  const picksMade = picks.length;
  
  // Separate Group Stage and Knockout picks
  const groupStagePicks = picks.filter(p => p.rounds?.round_number === 1 || !p.rounds);
  const knockoutPicks = picks.filter(p => p.rounds?.round_number >= 2);
  
  if (picksMade === 0) {
    container.innerHTML = `
      <div class="current-pick-card">
        <h3>Your Picks</h3>
        <p class="text-secondary">No picks yet.</p>
      </div>
    `;
    return;
  }
  
  // Show current round pick if in knockout stage
  if (currentRound && currentRound.round_number >= 2 && knockoutPicks.length > 0) {
    const currentRoundPick = knockoutPicks.find(p => p.round_id === currentRound.id);
    if (currentRoundPick) {
      const team = allTeams.find(t => t.id === currentRoundPick.team_id);
      const match = allMatches.find(m => m.home_team_id === currentRoundPick.team_id || m.away_team_id === currentRoundPick.team_id);
      const matchDate = match ? new Date(match.match_time) : null;
      const dateStr = matchDate ? matchDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      
      container.innerHTML = `
        <div class="current-pick-card">
          <h3>Your ${currentRound.name} Pick</h3>
          <div class="current-knockout-pick">
            <img src="${team?.flag_url || ''}" alt="${team?.name}" class="current-pick-flag">
            <div class="current-pick-details">
              <span class="current-pick-team">${team?.name || currentRoundPick.teams?.name}</span>
              <span class="current-pick-match">${dateStr}</span>
            </div>
            <span class="current-pick-status ${currentRoundPick.result}">${currentRoundPick.result}</span>
          </div>
        </div>
      `;
      return;
    }
  }
  
  // Default: Show Group Stage picks organized by matchday
  let html = `
    <div class="current-pick-card">
      <h3>Your Group Stage Picks</h3>
      <p>Total: ${picksMade} / 9 picks</p>
  `;
  
  // Group picks by matchday
  const picksByMatchday = { 1: [], 2: [], 3: [] };
  groupStagePicks.forEach(pick => {
    const matchday = pick.matchday || 1;
    if (picksByMatchday[matchday]) {
      picksByMatchday[matchday].push(pick);
    }
  });
  
  // Display each matchday
  [1, 2, 3].forEach(matchday => {
    const matchdayPicks = picksByMatchday[matchday];
    
    // Get matchday date from first pick's match
    let matchdayDate = '';
    if (matchdayPicks.length > 0) {
      const firstPick = matchdayPicks[0];
      const match = allMatches.find(m => 
        (m.home_team_id === firstPick.team_id || m.away_team_id === firstPick.team_id) &&
        m.matchday === matchday
      );
      if (match) {
        const date = new Date(match.match_time);
        matchdayDate = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      }
    }
    
    html += `
      <div class="matchday-section">
        <div class="matchday-header-card">
          <h4>Matchday ${matchday}</h4>
          <span class="matchday-date">${matchdayDate}</span>
        </div>
        <div class="matchday-picks-grid">
    `;
    
    if (matchdayPicks.length === 0) {
      html += '<p class="no-picks-yet">No picks yet</p>';
    } else {
      html += matchdayPicks.map(pick => {
        const match = allMatches.find(m => 
          (m.home_team_id === pick.team_id || m.away_team_id === pick.team_id) &&
          m.matchday === matchday
        );
        const matchDate = match ? new Date(match.match_time) : null;
        const dateStr = matchDate ? matchDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
        const timeStr = matchDate ? matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
        
        return `
          <div class="pick-card-themed ${pick.result || 'pending'}">
            <img src="${pick.teams?.flag_url}" alt="${pick.teams?.name}" class="matchday-pick-flag">
            <div class="matchday-pick-info">
              <span class="matchday-pick-team">${pick.teams?.name}</span>
              <span class="matchday-pick-time">${dateStr} @ ${timeStr}</span>
            </div>
            <span class="status-indicator ${pick.result || 'pending'}">${pick.result === 'win' ? '✓' : pick.result === 'loss' ? '✗' : '⏳'}</span>
            <span class="points-badge-themed">${pick.points > 0 ? '+' + pick.points : ''}</span>
          </div>
        `;
      }).join('');
    }
    
    html += '</div></div>';
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function displayTournamentHistory() {
  const container = document.getElementById('tournament-history');
  if (!container) return;
  
  // Define all rounds
  const allRounds = [
    { number: 1, name: 'Group Stage', picksRequired: 9 },
    { number: 2, name: 'Round of 32', picksRequired: 1 },
    { number: 3, name: 'Round of 16', picksRequired: 1 },
    { number: 4, name: 'Quarter Finals', picksRequired: 1 },
    { number: 5, name: 'Semi Finals', picksRequired: 1 },
    { number: 6, name: 'Final', picksRequired: 1 }
  ];
  
  // Group picks by round
  const picksByRound = {};
  userPicks.forEach(pick => {
    const roundNumber = pick.rounds?.round_number || 0;
    if (!picksByRound[roundNumber]) {
      picksByRound[roundNumber] = [];
    }
    picksByRound[roundNumber].push(pick);
  });
  
  let html = '<div class="tournament-history">';
  
  allRounds.forEach(round => {
    const roundPicks = picksByRound[round.number] || [];
    const hasPicks = roundPicks.length > 0;
    const isCurrentRound = currentRound && round.number === currentRound.round_number;
    const isFinal = round.number === 6;
    const isGroupStage = round.number === 1;
    const totalPoints = roundPicks.reduce((sum, p) => sum + (p.points || 0), 0);
    const wins = roundPicks.filter(p => p.result === 'win').length;
    const isUpcoming = !hasPicks && !isCurrentRound;
    
    // Group Stage gets special 3x3 grid layout
    if (isGroupStage) {
      html += `
        <div class="history-card-themed ${isCurrentRound ? 'current' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="margin: 0; font-size: 1.1rem;">
              ${isCurrentRound ? '<i class="fas fa-play-circle" style="color: #9333ea;"></i> ' : ''}
              ${round.name}
            </h3>
            <div style="text-align: right;">
              <span style="font-size: 1.2rem; font-weight: bold; color: var(--accent-gold);">${totalPoints} pts</span>
              <span style="font-size: 0.8rem; color: var(--text-secondary); display: block;">${wins} wins</span>
            </div>
          </div>
          
          <div class="round-picks-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem;">
            ${roundPicks.map(pick => `
              <div class="history-pick-themed ${pick.result || 'pending'}">
                <img src="${pick.teams?.flag_url}" alt="" style="width: 24px; height: 16px; object-fit: cover; border-radius: 0.125rem;">
                <span style="font-size: 0.65rem; line-height: 1.1;">${pick.teams?.name}</span>
                ${pick.result === 'win' ? `<span style="color: var(--accent-green); font-weight: bold; font-size: 0.65rem;">+${pick.points}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      // Knockout rounds get horizontal row layout
      html += `
        <div class="history-card-themed ${isCurrentRound ? 'current' : ''} ${isFinal ? 'final' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              ${isFinal ? '<span style="font-size: 1.5rem;">🏆</span>' : isCurrentRound ? '<i class="fas fa-play-circle" style="color: #9333ea;"></i>' : isUpcoming ? '<i class="fas fa-clock" style="color: var(--text-secondary);"></i>' : '<i class="fas fa-check-circle" style="color: var(--accent-green);"></i>'}
              <span style="font-weight: 600; ${isFinal ? 'color: var(--accent-gold); font-size: 1.1rem;' : ''}">${round.name}</span>
            </div>
            
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div class="round-teams-row" style="display: flex; gap: 0.3rem; ${!hasPicks ? 'opacity: 0.5;' : ''}">
                ${hasPicks ? roundPicks.map(pick => `
                  <div class="history-pick-mini-themed ${pick.result || 'pending'}">
                    <img src="${pick.teams?.flag_url}" alt="" style="width: 16px; height: 12px; object-fit: cover; border-radius: 0.125rem;">
                    <span style="font-size: 0.7rem; white-space: nowrap;">${pick.teams?.name}</span>
                    ${pick.result === 'win' ? `<span style="color: var(--accent-green); font-weight: bold; font-size: 0.65rem;">+${pick.points}</span>` : ''}
                  </div>
                `).join('') : `<span style="font-size: 0.75rem; color: var(--text-secondary); font-style: italic;">Not started</span>`}
              </div>
              
              <div style="text-align: right; min-width: 60px;">
                ${hasPicks ? `<span style="font-size: 1rem; font-weight: bold; color: ${isFinal ? 'var(--accent-gold)' : 'var(--text-primary)'};">${totalPoints} pts</span>` : `<span style="font-size: 0.8rem; color: var(--text-secondary);">${round.picksRequired} pick${round.picksRequired > 1 ? 's' : ''}</span>`}
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function updateStatusCard(data) {
  const statusDiv = document.getElementById('player-status');
  
  if (data.status === 'not_entered') {
    statusDiv.innerHTML = `
      <div class="not-entered">
        <i class="fas fa-info-circle"></i>
        <h3>Not Entered</h3>
        <p>You need to enter the tournament to play</p>
        <button class="btn btn-primary" onclick="enterTournament()" style="margin-top: 1rem;">
          <i class="fas fa-ticket-alt"></i> Enter Tournament (£30)
        </button>
      </div>
    `;
  } else {
    // Points-based system display
    const totalPoints = data.total_points !== undefined ? data.total_points : 0;
    const wins = data.wins !== undefined ? data.wins : 0;
    const rank = data.rank || '-';
    const isEliminated = data.status === 'eliminated';
    
    statusDiv.innerHTML = `
      <div class="${isEliminated ? 'eliminated' : 'active-status'}">
        <h2 class="user-name">${data.display_name || data.username || 'Player'}</h2>
        <p class="instruction-text">Pick teams to win and earn points. More points in later rounds!</p>
        
        <div class="points-stats-row">
          <div class="points-stat">
            <div class="points-value">${totalPoints}</div>
            <div class="points-label">Total Points</div>
          </div>
          <div class="points-stat">
            <div class="points-value">${wins}</div>
            <div class="points-label">Correct Picks</div>
          </div>
          <div class="points-stat">
            <div class="points-value">#${rank}</div>
            <div class="points-label">Rank</div>
          </div>
        </div>
        
        ${isEliminated ? 
          `<p class="eliminated-text"><i class="fas fa-times-circle"></i> Eliminated - No more picks allowed</p>` :
          data.current_round === 'waiting' ?
          `<p class="waiting-text"><i class="fas fa-clock"></i> Waiting for next round</p>` :
          currentRound && currentRound.round_number >= 2 ?
          `<p class="round-text"><i class="fas fa-play-circle"></i> ${currentRound.name}</p>` :
          `<p class="matchday-text">Matchday ${data.current_matchday || currentMatchday}</p>`
        }
      </div>
    `;
  }
}

async function enterTournament() {
  const token = localStorage.getItem('wc_lms_token');
  
  if (!confirm('Enter the World Cup 2026 Last Man Standing tournament?\n\nEntry fee: £30\nMax 100 players\nPrize pool: Winner takes all!')) {
    return;
  }
  
  try {
    const tourneyResponse = await fetch('/api/tournaments');
    const tourneyData = await tourneyResponse.json();
    
    if (!tourneyData.tournaments || tourneyData.tournaments.length === 0) {
      alert('No tournament available. Please contact admin.');
      return;
    }
    
    const tournamentId = tourneyData.tournaments[0].id;
    
    const response = await fetch('/api/entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ tournament_id: tournamentId })
    });
    
    if (response.ok) {
      alert('You have entered the tournament! Good luck!');
      loadDashboard();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to enter tournament');
    }
  } catch (error) {
    alert('Error entering tournament: ' + error.message);
  }
}

function displayRoundMatches(matches, currentRound) {
  const container = document.getElementById('round-matches');
  if (!container) return;
  
  // Show ALL matches from ALL rounds, sorted by date
  const allMatchesSorted = [...(matches || [])].sort((a, b) => new Date(a.match_time) - new Date(b.match_time));
  
  if (allMatchesSorted.length === 0) {
    container.innerHTML = '<p class="text-secondary">No matches scheduled.</p>';
    return;
  }
  
  // Group matches by round
  const matchesByRound = {};
  allMatchesSorted.forEach(m => {
    const roundName = m.rounds?.name || 'Unknown Round';
    if (!matchesByRound[roundName]) {
      matchesByRound[roundName] = [];
    }
    matchesByRound[roundName].push(m);
  });
  
  // Round order for display
  const roundOrder = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter Finals', 'Semi Finals', 'Final'];
  
  let html = '<div class="matches-list-compact all-rounds">';
  
  // Display rounds in order
  roundOrder.forEach(roundName => {
    const roundMatches = matchesByRound[roundName];
    if (!roundMatches || roundMatches.length === 0) return;
    
    const isCurrentRound = currentRound && currentRound.name === roundName;
    
    html += `<div class="round-matches-section ${isCurrentRound ? 'current' : ''}">`;
    html += `<h5 class="round-header">${roundName} ${isCurrentRound ? '<span class="current-badge">CURRENT</span>' : ''}</h5>`;
    
    roundMatches.forEach(m => {
      const time = new Date(m.match_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const date = new Date(m.match_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      
      const hasScore = m.home_score !== null && m.home_score !== undefined;
      const isFinished = m.status === 'finished' || hasScore;
      
      html += `
        <div class="match-compact-item ${isFinished ? 'finished' : ''} ${m.status === 'live' ? 'live' : ''}">
          <div class="match-compact-teams">
            <img src="${m.home_team?.flag_url}" alt="" class="match-compact-flag">
            <span class="${hasScore && m.home_score > m.away_score ? 'winner' : ''}">${m.home_team?.name}</span>
            ${hasScore ? `<span class="match-score">${m.home_score}</span>` : '<span class="match-score-placeholder">-</span>'}
            <span class="vs">vs</span>
            ${hasScore ? `<span class="match-score">${m.away_score}</span>` : '<span class="match-score-placeholder">-</span>'}
            <span class="${hasScore && m.away_score > m.home_score ? 'winner' : ''}">${m.away_team?.name}</span>
            <img src="${m.away_team?.flag_url}" alt="" class="match-compact-flag">
          </div>
          <span class="match-compact-time">${date} ${time}</span>
          ${m.status === 'live' ? '<span class="live-badge">LIVE</span>' : ''}
          ${isFinished ? '<span class="finished-badge"><i class="fas fa-check"></i></span>' : ''}
        </div>
      `;
    });
    
    html += '</div>';
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function displayGroupResults() {
  const container = document.getElementById('group-results');
  if (!container) return;
  
  // Group teams by their group_name
  const teamsByGroup = {};
  allTeams.forEach(team => {
    if (team.group_name) {
      if (!teamsByGroup[team.group_name]) {
        teamsByGroup[team.group_name] = [];
      }
      teamsByGroup[team.group_name].push(team);
    }
  });
  
  // Sort groups alphabetically
  const sortedGroups = Object.keys(teamsByGroup).sort();
  
  if (sortedGroups.length === 0) {
    container.innerHTML = '<p class="text-secondary">No group data available.</p>';
    return;
  }
  
  let html = '<div class="groups-grid">';
  
  sortedGroups.forEach(groupName => {
    const groupTeams = teamsByGroup[groupName];
    
    // Sort teams by points (descending), then goal difference, then goals scored
    groupTeams.sort((a, b) => {
      if ((b.group_points || 0) !== (a.group_points || 0)) {
        return (b.group_points || 0) - (a.group_points || 0);
      }
      if ((b.goal_difference || 0) !== (a.goal_difference || 0)) {
        return (b.goal_difference || 0) - (a.goal_difference || 0);
      }
      return (b.goals_scored || 0) - (a.goals_scored || 0);
    });
    
    html += `
      <div class="group-card">
        <h4 class="group-title">Group ${groupName}</h4>
        <div class="group-teams">
          ${groupTeams.map((team, index) => `
            <div class="group-team-row ${index < 2 ? 'qualified' : ''}">
              <span class="team-position">${index + 1}</span>
              <img src="${team.flag_url}" alt="${team.name}" class="group-team-flag">
              <span class="team-name">${team.name}</span>
              <span class="team-points">${team.group_points || 0} pts</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function displayKnockoutGrid() {
  const container = document.getElementById('knockout-grid');
  if (!container) return;
  
  // Get all teams that qualified for knockout (have qualified_for_ko flag or are top 2 in groups + 8 best 3rd place)
  // For now, we'll show a placeholder structure
  
  let html = '<div class="knockout-bracket">';
  
  html += `
    <div class="knockout-rounds">
      <div class="knockout-round">
        <h4>Round of 32</h4>
        <p class="knockout-info">Top 2 from each group + 8 best 3rd place teams</p>
        <div class="ko-teams-grid" id="r32-teams">
          <p class="text-secondary">Teams will be determined after Group Stage</p>
        </div>
      </div>
      
      <div class="knockout-round">
        <h4>Round of 16</h4>
        <div class="ko-teams-grid" id="r16-teams">
          <p class="text-secondary">Winners from Round of 32</p>
        </div>
      </div>
      
      <div class="knockout-round">
        <h4>Quarter Finals</h4>
        <div class="ko-teams-grid" id="qf-teams">
          <p class="text-secondary">Winners from Round of 16</p>
        </div>
      </div>
      
      <div class="knockout-round">
        <h4>Semi Finals</h4>
        <div class="ko-teams-grid" id="sf-teams">
          <p class="text-secondary">Winners from Quarter Finals</p>
        </div>
      </div>
      
      <div class="knockout-round final">
        <h4>Final</h4>
        <div class="ko-teams-grid" id="f-teams">
          <p class="text-secondary">Winners from Semi Finals</p>
        </div>
      </div>
    </div>
  `;
  
  html += '</div>';
  container.innerHTML = html;
  
  // Load qualified teams if available
  loadQualifiedTeams();
}

async function loadQualifiedTeams() {
  try {
    const response = await fetch('/api/qualified-teams');
    if (response.ok) {
      const data = await response.json();
      
      // Update Round of 32 teams
      if (data.r32 && data.r32.length > 0) {
        const r32Container = document.getElementById('r32-teams');
        if (r32Container) {
          r32Container.innerHTML = data.r32.map(team => `
            <div class="ko-team-item">
              <img src="${team.flag_url}" alt="${team.name}" class="ko-team-flag">
              <span class="ko-team-name">${team.name}</span>
              <span class="ko-team-source">${team.qualified_from || ''}</span>
            </div>
          `).join('');
        }
      }
    }
  } catch (e) {
    console.log('Could not load qualified teams:', e);
  }
}

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  // Show selected tab
  document.getElementById(`tab-content-${tabName}`).style.display = 'block';
  document.getElementById(`tab-${tabName}`).classList.add('active');
  
  // Load content for specific tabs
  if (tabName === 'groups') {
    displayGroupResults();
  } else if (tabName === 'knockout') {
    displayKnockoutGrid();
  }
}

document.addEventListener('DOMContentLoaded', loadDashboard);
