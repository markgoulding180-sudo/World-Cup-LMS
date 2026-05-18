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

  // Body parser - always parse for POST requests
  let bodyData = '';
  if (!req.body || Object.keys(req.body).length === 0) {
    try {
      bodyData = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
      if (bodyData) {
        req.body = JSON.parse(bodyData);
      }
    } catch (e) {
      console.error('Body parse error:', e);
      req.body = {};
    }
  }

  const { action, ...data } = req.body || {};

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET
  );

  // LOGIN
  if (action === 'login') {
    try {
      const { email, password } = data;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Login error:', error);
        return res.status(401).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        session: authData.session,
        user: authData.user
      });

    } catch (error) {
      console.error('Login exception:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // REGISTER
  if (action === 'register') {
    try {
      const { email, password, username, display_name } = data;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });

      if (authError) {
        console.error('Register auth error:', authError);
        return res.status(400).json({ error: authError.message });
      }

      if (!authData.user) {
        return res.status(500).json({ error: 'User creation failed - no user returned' });
      }

      // Create user profile (trigger may also do this, so use upsert to avoid conflict)
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          username: (username || email.split('@')[0])?.slice(0, 20),
          display_name: (display_name || email.split('@')[0])?.slice(0, 20),
          email
        }, { onConflict: 'id' });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        return res.status(500).json({ error: 'Failed to create profile: ' + profileError.message });
      }

      return res.status(200).json({
        success: true,
        message: 'Registration successful'
      });

    } catch (error) {
      console.error('Register exception:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
};
