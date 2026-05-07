// Vercel Function: Auth (Login + Register)
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

  const { action, ...data } = req.body;
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET
  );

  // LOGIN
  if (action === 'login') {
    try {
      const { email, password } = data;
      
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return res.status(401).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        session: authData.session,
        user: authData.user
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // REGISTER
  if (action === 'register') {
    try {
      const { email, password, username, display_name } = data;
      
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });

      if (authError) {
        return res.status(400).json({ error: authError.message });
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          username,
          display_name,
          email
        });

      if (profileError) {
        return res.status(500).json({ error: 'Failed to create profile' });
      }

      return res.status(200).json({
        success: true,
        message: 'Registration successful'
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
};
