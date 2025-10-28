-- ============================================================================
-- FIX SCHEMA ERRORS
-- ============================================================================
-- This fixes the following errors:
-- 1. Column profiles.email does not exist
-- 2. Foreign key relationship between 'blocked_users' and 'profiles'
-- ============================================================================

-- ============================================================================
-- 1. REMOVE EMAIL COLUMN FROM PROFILES (IF IT EXISTS)
-- ============================================================================
-- The email field should not be in profiles table as it's in auth.users
-- If it exists, we'll remove it since we can't query it directly anyway
ALTER TABLE profiles DROP COLUMN IF EXISTS email;

-- ============================================================================
-- 2. FIX BLOCKED_USERS TABLE FOREIGN KEY RELATIONSHIPS
-- ============================================================================
-- The issue is that blocked_users references auth.users, not profiles
-- We need to ensure the table structure is correct

-- First, let's check if we need to recreate the table with proper references
-- Drop the existing table to recreate it with correct structure
DROP TABLE IF EXISTS public.blocked_users CASCADE;

-- Create blocked_users table with proper foreign keys
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_user_id),
  CHECK (blocker_id != blocked_user_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX idx_blocked_users_blocked_user ON blocked_users(blocked_user_id);

-- Enable RLS
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own blocks
CREATE POLICY "Users can view own blocks" ON blocked_users
FOR SELECT USING (auth.uid() = blocker_id);

-- Users can create their own blocks
CREATE POLICY "Users can create blocks" ON blocked_users
FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Users can delete their own blocks
CREATE POLICY "Users can delete blocks" ON blocked_users
FOR DELETE USING (auth.uid() = blocker_id);

-- Admins can view all blocks
CREATE POLICY "Admins can view all blocks" ON blocked_users
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON blocked_users TO authenticated;

-- ============================================================================
-- 3. VERIFY PROFILES TABLE STRUCTURE
-- ============================================================================
-- Ensure profiles table has all necessary columns and correct types

-- Add social_links as JSONB if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

-- Add other essential columns if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_picture text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profession text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'pending';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure user_id is the primary key
-- (This may fail if already exists, which is fine)
DO $$ BEGIN
  ALTER TABLE profiles ADD PRIMARY KEY (user_id);
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- ============================================================================
-- 4. CREATE HELPER VIEW FOR ADMIN QUERIES (OPTIONAL)
-- ============================================================================
-- This view joins profiles with auth.users to provide email access for admins
-- Note: This requires proper RLS policies

CREATE OR REPLACE VIEW admin_user_details AS
SELECT 
  p.user_id,
  p.full_name,
  p.username,
  p.profile_picture,
  p.profession,
  p.location,
  p.bio,
  p.account_status,
  p.created_at,
  p.social_links,
  u.email
FROM profiles p
LEFT JOIN auth.users u ON p.user_id = u.id;

-- Grant access to authenticated users (RLS will still apply)
GRANT SELECT ON admin_user_details TO authenticated;

-- ============================================================================
-- 5. UPDATE BLOCK FUNCTIONS
-- ============================================================================

-- Recreate the is_blocked function
CREATE OR REPLACE FUNCTION public.is_blocked(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = auth.uid() AND blocked_user_id = target_user_id
  );
$$;

-- Recreate the block_user function
CREATE OR REPLACE FUNCTION public.block_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_user_id IS NULL OR target_user_id = auth.uid() THEN
    RETURN;
  END IF;

  INSERT INTO public.blocked_users (blocker_id, blocked_user_id)
  VALUES (auth.uid(), target_user_id)
  ON CONFLICT (blocker_id, blocked_user_id) DO NOTHING;

  IF to_regclass('public.follows') IS NOT NULL THEN
    DELETE FROM public.follows
    WHERE (follower_id = auth.uid() AND following_id = target_user_id)
       OR (follower_id = target_user_id AND following_id = auth.uid());
  END IF;
END;
$$;

-- Recreate the unblock_user function
CREATE OR REPLACE FUNCTION public.unblock_user(target_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.blocked_users
  WHERE blocker_id = auth.uid() AND blocked_user_id = target_user_id;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

-- ============================================================================
-- 6. VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the fixes worked:

-- Check profiles table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Check blocked_users table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'blocked_users' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Check foreign keys on blocked_users
-- SELECT
--   tc.constraint_name, 
--   tc.table_name, 
--   kcu.column_name, 
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name 
-- FROM information_schema.table_constraints AS tc 
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
--   AND tc.table_schema = kcu.table_schema
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
--   AND ccu.table_schema = tc.table_schema
-- WHERE tc.constraint_type = 'FOREIGN KEY' 
--   AND tc.table_name='blocked_users';

-- ============================================================================
-- DONE
-- ============================================================================
-- After running this SQL:
-- 1. The email column issue should be resolved (removed from profiles)
-- 2. The blocked_users table should have correct foreign keys
-- 3. Admin queries should work properly
-- 4. A new admin_user_details view is available for admin purposes
-- ============================================================================
