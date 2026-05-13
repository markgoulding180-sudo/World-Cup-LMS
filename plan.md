// Supabase Migration Runner
// Run this with: node run-migrations.js
// Requires: SUPABASE_URL and SUPABASE_SECRET environment variables

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jqctbpuulyhghrxjmqee.supabase.co';
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;

if (!SUPABASE_SECRET) {
  console.error('❌ Error: SUPABASE_SECRET environment variable is required');
  console.error('');
  console.error('Usage:');
  console.error('  set SUPABASE_SECRET=your_service_role_key_here && node run-migrations.js');
  console.error('');
  console.error('Or create a .env file with:');
  console.error('  SUPABASE_SECRET=your_service_role_key_here');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET);

const migrations = [
  {
    name: 'Add Lives System',
    sql: `
      -- Add lives setting to tournaments
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS lives INTEGER DEFAULT 3;

      -- Add lives tracking to tournament entries
      ALTER TABLE tournament_entries 
        ADD COLUMN IF NOT EXISTS lives_remaining INTEGER DEFAULT 3,
        ADD COLUMN IF NOT EXISTS max_lives INTEGER DEFAULT 3;

      -- Add picks required per round
      ALTER TABLE rounds ADD COLUMN IF NOT EXISTS picks_required INTEGER DEFAULT 1;

      -- Update existing data
      UPDATE tournaments SET lives = 3 WHERE lives IS NULL;
      UPDATE tournament_entries SET lives_remaining = 3, max_lives = 3 WHERE lives_remaining IS NULL;
      UPDATE rounds SET picks_required = 1 WHERE picks_required IS NULL;

      -- Update round picks_required based on round number
      UPDATE rounds SET picks_required = 3 WHERE round_number <= 3;
      UPDATE rounds SET picks_required = 1 WHERE round_number > 3;
    `
  },
  {
    name: 'Allow Multiple Picks Per Round',
    sql: `
      -- Drop the old unique constraint that only allowed 1 pick per round
      ALTER TABLE picks DROP CONSTRAINT IF EXISTS picks_tournament_id_user_id_round_id_key;

      -- Add new constraint: prevents duplicate teams in same round, but allows multiple picks
      ALTER TABLE picks ADD CONSTRAINT picks_unique_team_per_round 
        UNIQUE (tournament_id, user_id, round_id, team_id);
    `
  },
  {
    name: 'Add Matchday Columns',
    sql: `
      -- Add matchday column to matches table
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS matchday INTEGER;

      -- Add matchday column to picks table
      ALTER TABLE picks ADD COLUMN IF NOT EXISTS matchday INTEGER;

      -- Create indexes for faster queries
      CREATE INDEX IF NOT EXISTS idx_matches_matchday ON matches(matchday);
      CREATE INDEX IF NOT EXISTS idx_picks_matchday ON picks(matchday);

      -- Update Group Stage to require 9 picks (3 per matchday)
      UPDATE rounds SET picks_required = 9 WHERE round_number = 1 AND name ILIKE '%group%';
    `
  },
  {
    name: 'Distribute Matches to Matchdays',
    sql: `
      -- Get the round 1 ID
      DO $$
      DECLARE
        group_round_id UUID;
        match_record RECORD;
        match_counter INTEGER := 0;
      BEGIN
        SELECT id INTO group_round_id FROM rounds WHERE round_number = 1 LIMIT 1;
        
        IF group_round_id IS NOT NULL THEN
          -- Assign matchday based on chronological order
          FOR match_record IN 
            SELECT id FROM matches 
            WHERE round_id = group_round_id 
            ORDER BY match_time
          LOOP
            match_counter := match_counter + 1;
            
            -- First 24 matches = Matchday 1
            -- Next 24 matches = Matchday 2  
            -- Last 24 matches = Matchday 3
            UPDATE matches 
            SET matchday = CASE 
              WHEN match_counter <= 24 THEN 1
              WHEN match_counter <= 48 THEN 2
              ELSE 3
            END
            WHERE id = match_record.id;
          END LOOP;
          
          RAISE NOTICE 'Assigned % matches to matchdays', match_counter;
        END IF;
      END $$;
    `
  }
];

async function runMigrations() {
  console.log('🚀 World Cup LMS Database Migrations');
  console.log('=====================================\n');
  console.log(`Connecting to: ${SUPABASE_URL}\n`);

  for (const migration of migrations) {
    console.log(`📦 Running: ${migration.name}...`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql });
      
      if (error) {
        // Try direct query if RPC fails
        const { error: queryError } = await supabase.from('_exec_sql').select('*').eq('query', migration.sql);
        
        if (queryError && !queryError.message.includes('does not exist')) {
          console.error(`   ❌ Failed: ${error.message}`);
          
          // Check if it's a "column already exists" error - that's OK
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log(`   ⚠️  Already applied (skipping)`);
            continue;
          }
          
          // Check if constraint already exists
          if (error.message.includes('constraint') && error.message.includes('already exists')) {
            console.log(`   ⚠️  Constraint already exists (skipping)`);
            continue;
          }
          
          throw error;
        }
      }
      
      console.log(`   ✅ Success`);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      
      // If it's just "already exists" errors, continue
      if (err.message.includes('already exists') || err.code === '42701') {
        console.log(`   ⚠️  Already applied (continuing)`);
      } else {
        console.error('\n⛔ Migration failed. Please check the error above.');
        process.exit(1);
      }
    }
  }

  console.log('\n=====================================');
  console.log('✅ All migrations completed!');
  console.log('\nNext steps:');
  console.log('  1. Verify in Supabase: SELECT * FROM rounds ORDER BY round_number;');
  console.log('  2. Check matchdays: SELECT matchday, COUNT(*) FROM matches GROUP BY matchday;');
  console.log('  3. Deploy frontend to Vercel if not already done');
}

runMigrations().catch(err => {
  console.error('\n⛔ Unexpected error:', err.message);
  process.exit(1);
});
