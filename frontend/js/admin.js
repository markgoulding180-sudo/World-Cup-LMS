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
  // Load rounds, matches, picks
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
