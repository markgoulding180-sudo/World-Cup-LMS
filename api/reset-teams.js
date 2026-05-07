// Vercel Function: Reset and import correct World Cup 2026 teams
const { createClient } = require('@supabase/supabase-js');

// World Cup 2026 teams with groups (from openfootball data)
const WORLD_CUP_TEAMS = [
  // Group A
  { name: 'Mexico', group_name: 'A', code: 'MEX', flag_url: 'https://flagcdn.com/w80/mx.png' },
  { name: 'South Africa', group_name: 'A', code: 'RSA', flag_url: 'https://flagcdn.com/w80/za.png' },
  { name: 'South Korea', group_name: 'A', code: 'KOR', flag_url: 'https://flagcdn.com/w80/kr.png' },
  { name: 'Czech Republic', group_name: 'A', code: 'CZE', flag_url: 'https://flagcdn.com/w80/cz.png' },
  
  // Group B
  { name: 'Canada', group_name: 'B', code: 'CAN', flag_url: 'https://flagcdn.com/w80/ca.png' },
  { name: 'Bosnia & Herzegovina', group_name: 'B', code: 'BIH', flag_url: 'https://flagcdn.com/w80/ba.png' },
  { name: 'Qatar', group_name: 'B', code: 'QAT', flag_url: 'https://flagcdn.com/w80/qa.png' },
  { name: 'Switzerland', group_name: 'B', code: 'SUI', flag_url: 'https://flagcdn.com/w80/ch.png' },
  
  // Group C
  { name: 'Brazil', group_name: 'C', code: 'BRA', flag_url: 'https://flagcdn.com/w80/br.png' },
  { name: 'Morocco', group_name: 'C', code: 'MAR', flag_url: 'https://flagcdn.com/w80/ma.png' },
  { name: 'Haiti', group_name: 'C', code: 'HAI', flag_url: 'https://flagcdn.com/w80/ht.png' },
  { name: 'Scotland', group_name: 'C', code: 'SCO', flag_url: 'https://flagcdn.com/w80/gb-sct.png' },
  
  // Group D
  { name: 'USA', group_name: 'D', code: 'USA', flag_url: 'https://flagcdn.com/w80/us.png' },
  { name: 'Paraguay', group_name: 'D', code: 'PAR', flag_url: 'https://flagcdn.com/w80/py.png' },
  { name: 'Australia', group_name: 'D', code: 'AUS', flag_url: 'https://flagcdn.com/w80/au.png' },
  { name: 'Turkey', group_name: 'D', code: 'TUR', flag_url: 'https://flagcdn.com/w80/tr.png' },
  
  // Group E
  { name: 'Germany', group_name: 'E', code: 'GER', flag_url: 'https://flagcdn.com/w80/de.png' },
  { name: 'Curaçao', group_name: 'E', code: 'CUR', flag_url: 'https://flagcdn.com/w80/cw.png' },
  { name: 'Ivory Coast', group_name: 'E', code: 'CIV', flag_url: 'https://flagcdn.com/w80/ci.png' },
  { name: 'Ecuador', group_name: 'E', code: 'ECU', flag_url: 'https://flagcdn.com/w80/ec.png' },
  
  // Group F
  { name: 'Netherlands', group_name: 'F', code: 'NED', flag_url: 'https://flagcdn.com/w80/nl.png' },
  { name: 'Japan', group_name: 'F', code: 'JPN', flag_url: 'https://flagcdn.com/w80/jp.png' },
  { name: 'Sweden', group_name: 'F', code: 'SWE', flag_url: 'https://flagcdn.com/w80/se.png' },
  { name: 'Tunisia', group_name: 'F', code: 'TUN', flag_url: 'https://flagcdn.com/w80/tn.png' },
  
  // Group G
  { name: 'Belgium', group_name: 'G', code: 'BEL', flag_url: 'https://flagcdn.com/w80/be.png' },
  { name: 'Egypt', group_name: 'G', code: 'EGY', flag_url: 'https://flagcdn.com/w80/eg.png' },
  { name: 'Iran', group_name: 'G', code: 'IRN', flag_url: 'https://flagcdn.com/w80/ir.png' },
  { name: 'New Zealand', group_name: 'G', code: 'NZL', flag_url: 'https://flagcdn.com/w80/nz.png' },
  
  // Group H
  { name: 'Spain', group_name: 'H', code: 'ESP', flag_url: 'https://flagcdn.com/w80/es.png' },
  { name: 'Cape Verde', group_name: 'H', code: 'CPV', flag_url: 'https://flagcdn.com/w80/cv.png' },
  { name: 'Saudi Arabia', group_name: 'H', code: 'KSA', flag_url: 'https://flagcdn.com/w80/sa.png' },
  { name: 'Uruguay', group_name: 'H', code: 'URU', flag_url: 'https://flagcdn.com/w80/uy.png' },
  
  // Group I
  { name: 'France', group_name: 'I', code: 'FRA', flag_url: 'https://flagcdn.com/w80/fr.png' },
  { name: 'Senegal', group_name: 'I', code: 'SEN', flag_url: 'https://flagcdn.com/w80/sn.png' },
  { name: 'Iraq', group_name: 'I', code: 'IRQ', flag_url: 'https://flagcdn.com/w80/iq.png' },
  { name: 'Norway', group_name: 'I', code: 'NOR', flag_url: 'https://flagcdn.com/w80/no.png' },
  
  // Group J
  { name: 'Argentina', group_name: 'J', code: 'ARG', flag_url: 'https://flagcdn.com/w80/ar.png' },
  { name: 'Algeria', group_name: 'J', code: 'ALG', flag_url: 'https://flagcdn.com/w80/dz.png' },
  { name: 'Austria', group_name: 'J', code: 'AUT', flag_url: 'https://flagcdn.com/w80/at.png' },
  { name: 'Jordan', group_name: 'J', code: 'JOR', flag_url: 'https://flagcdn.com/w80/jo.png' },
  
  // Group K
  { name: 'Portugal', group_name: 'K', code: 'POR', flag_url: 'https://flagcdn.com/w80/pt.png' },
  { name: 'DR Congo', group_name: 'K', code: 'COD', flag_url: 'https://flagcdn.com/w80/cd.png' },
  { name: 'Uzbekistan', group_name: 'K', code: 'UZB', flag_url: 'https://flagcdn.com/w80/uz.png' },
  { name: 'Colombia', group_name: 'K', code: 'COL', flag_url: 'https://flagcdn.com/w80/co.png' },
  
  // Group L
  { name: 'England', group_name: 'L', code: 'ENG', flag_url: 'https://flagcdn.com/w80/gb-eng.png' },
  { name: 'Croatia', group_name: 'L', code: 'CRO', flag_url: 'https://flagcdn.com/w80/hr.png' },
  { name: 'Ghana', group_name: 'L', code: 'GHA', flag_url: 'https://flagcdn.com/w80/gh.png' },
  { name: 'Panama', group_name: 'L', code: 'PAN', flag_url: 'https://flagcdn.com/w80/pa.png' }
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET
    );

    // Step 1: Delete all existing teams
    console.log('Deleting existing teams...');
    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete existing teams', details: deleteError.message });
    }

    // Step 2: Insert correct teams
    console.log('Inserting correct teams...');
    const { data: insertedTeams, error: insertError } = await supabase
      .from('teams')
      .insert(WORLD_CUP_TEAMS)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to insert teams', details: insertError.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Teams reset and re-imported successfully',
      teamsInserted: insertedTeams?.length || 0,
      teams: insertedTeams?.map(t => ({ name: t.name, group: t.group_name, code: t.code }))
    });

  } catch (error) {
    console.error('Reset error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};
