-- Migration: Add is_admin column to users table
-- Run this in your Supabase SQL Editor

-- Add is_admin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create index for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Update existing users to have is_admin = false (if not already set)
UPDATE users SET is_admin = FALSE WHERE is_admin IS NULL;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'is_admin';
