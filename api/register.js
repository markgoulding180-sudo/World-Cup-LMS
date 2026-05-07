// Vercel Function: Register User
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, display_name, email, password } = req.body;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET
    );

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Insert user profile
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        username,
        display_name,
        email
      });

    if (userError) {
      return res.status(500).json({ error: userError.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Account created successfully'
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
