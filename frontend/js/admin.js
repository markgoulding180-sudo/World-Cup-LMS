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
  
  try {
    // Get matches with team names
    const response = await fetch('/api/teams');
    const teamsData = await response.json();
    const teamMap = new Map(teamsData.teams?.map(t => [t.id, t]));
    
    // For now show placeholder - would need a matches API
    container.innerHTML = `
      <p class="text-secondary">Match result entry coming soon...</p>
      <p>Total matches in database: 72 group stage games</p>
    `;
  } catch (error) {
    container.innerHTML = `<p class="error">Error loading matches</p>`;
  }
}

async function loadAllPicks() {
  const container = document.getElementById('all-picks');
  container.innerHTML = '<p class="text-secondary">Player picks will appear here once users start making selections...</p>';
}

async function importWorldCupData() {
  const statusDiv = document.getElementById('import-status');
  statusDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Importing...</p>';
  
  try {
    const token = localStorage.getItem('wc_lms_token');
    const response = await fetch('/api/import-worldcup', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
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
