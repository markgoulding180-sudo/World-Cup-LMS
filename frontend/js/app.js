// World Cup Last Man Standing - Main JavaScript

const API_BASE = '/api';

// Supabase configuration
const SUPABASE_URL = 'https://jqctbpuulyhghrxjmqee.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vz_kucACOudTn42svAhgg_ZjR9C1KJ1q5A';

// Initialize Supabase
let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Auth state
let currentUser = null;
// Check localStorage first, then sessionStorage
let authToken = localStorage.getItem('wc_lms_token') || sessionStorage.getItem('wc_lms_token') || null;

// Load user from storage (localStorage first, then sessionStorage)
const storedUser = localStorage.getItem('wc_lms_user') || sessionStorage.getItem('wc_lms_user');
if (storedUser) {
  try {
    currentUser = JSON.parse(storedUser);
  } catch (e) {
    console.error('Failed to parse stored user:', e);
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

async function initApp() {
  // Refresh token if exists
  if (authToken) {
    await validateSession();
  }
  
  // Update UI based on auth state
  updateAuthUI();
  
  // Page-specific initialization
  const path = window.location.pathname;
  
  if (path.includes('login')) {
    initLoginPage();
  } else if (path.includes('register')) {
    initRegisterPage();
  } else if (path.includes('dashboard')) {
    await initDashboardPage();
  } else if (path.includes('leaderboard')) {
    await initLeaderboardPage();
  } else if (path.includes('admin')) {
    await initAdminPage();
  } else {
    await initHomePage();
  }
}

// Auth Functions
async function validateSession() {
  try {
    const response = await fetch(`${API_BASE}/leaderboard?limit=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) {
      logout();
    }
  } catch (error) {
    console.error('Session validation error:', error);
  }
}

async function loginUser(credentials) {
  try {
    const { rememberMe = true, ...authCredentials } = credentials;
    
    const response = await fetch(`${API_BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', ...authCredentials })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    authToken = data.session.access_token;
    currentUser = data.user;
    
    // Store in localStorage if rememberMe is checked, otherwise use sessionStorage
    if (rememberMe) {
      localStorage.setItem('wc_lms_token', authToken);
      localStorage.setItem('wc_lms_user', JSON.stringify(currentUser));
    } else {
      sessionStorage.setItem('wc_lms_token', authToken);
      sessionStorage.setItem('wc_lms_user', JSON.stringify(currentUser));
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function registerUser(userData) {
  try {
    const response = await fetch(`${API_BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', ...userData })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  // Clear both storage types
  localStorage.removeItem('wc_lms_token');
  localStorage.removeItem('wc_lms_user');
  sessionStorage.removeItem('wc_lms_token');
  sessionStorage.removeItem('wc_lms_user');
  window.location.href = '/login.html';
}

function updateAuthUI() {
  // Update UI based on auth state
  if (currentUser) {
    // Hide login/register links, show logout
    const loginLinks = document.querySelectorAll('a[href="login.html"]');
    loginLinks.forEach(link => {
      link.textContent = 'Logout';
      link.href = '#';
      link.onclick = logout;
    });
  }
}

// Page Initializations
function initLoginPage() {
  const form = document.getElementById('login-form');
  if (!form) return;
  
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me')?.checked ?? true;
    
    const result = await loginUser({ email, password, rememberMe });
    
    if (result.success) {
      window.location.href = '/dashboard.html';
    } else {
      alert(result.error);
    }
  });
}

function initRegisterPage() {
  const form = document.getElementById('register-form');
  if (!form) return;
  
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userData = {
      username: document.getElementById('username').value,
      display_name: document.getElementById('display-name').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    };
    
    const result = await registerUser(userData);
    
    if (result.success) {
      alert('Registration successful! Please login.');
      window.location.href = '/login.html';
    } else {
      alert(result.error);
    }
  });
}

async function initHomePage() {
  // Load stats
  try {
    const response = await fetch(`${API_BASE}/leaderboard?limit=1`);
    const data = await response.json();
    
    // Update stats on page
    document.getElementById('active-players').textContent = data.stats?.total_players || '--';
    document.getElementById('prize-pool').textContent = data.stats?.prize_pool ? `£${data.stats.prize_pool}` : '£--';
    document.getElementById('current-round').textContent = data.stats?.current_round || '--';
  } catch (error) {
    console.error('Error loading home page stats:', error);
  }
}

async function initDashboardPage() {
  if (!authToken) {
    window.location.href = '/login.html';
    return;
  }
  
  // Load dashboard data
  console.log('Loading dashboard...');
}

async function initLeaderboardPage() {
  console.log('Loading leaderboard...');
}

async function initAdminPage() {
  if (!authToken) {
    window.location.href = '/login.html';
    return;
  }
  
  console.log('Loading admin panel...');
}
