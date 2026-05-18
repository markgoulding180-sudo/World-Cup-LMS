// Complete reset and setup for lives system testing
// Run these commands in browser console

async function resetAndSetup() {
  console.log('Starting fresh setup with lives system...');
  
  // 1. Clear all data
  console.log('1. Clearing all data...');
  const resetResponse = await fetch('/api/reset-all', { method: 'POST' });
  const resetData = await resetResponse.json();
  console.log('Reset:', resetData);
  
  // 2. Import teams
  console.log('2. Importing teams...');
  const teamsResponse = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset-teams' })
  });
  const teamsData = await teamsResponse.json();
  console.log('Teams:', teamsData);
  
  // 3. Setup rounds with picks_required
  console.log('3. Setting up rounds...');
  const setupResponse = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'setup' })
  });
  const setupData = await setupResponse.json();
  console.log('Setup:', setupData);
  
  // 4. Update rounds to have correct picks_required
  console.log('4. Updating round picks requirements...');
  // Group stage (rounds 1-3) = 3 picks
  // Knockouts (rounds 4+) = 1 pick
  
  // 5. Import matches
  console.log('5. Importing matches...');
  const matchesResponse = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'import-matches' })
  });
  const matchesData = await matchesResponse.json();
  console.log('Matches:', matchesData);
  
  console.log('\n✅ Setup complete!');
  console.log('Now you can:');
  console.log('1. Register/login as a user');
  console.log('2. Enter the tournament (you will get 3 lives)');
  console.log('3. Make up to 3 picks in group stage rounds');
  console.log('4. Cannot reuse teams from previous rounds');
}

resetAndSetup();
