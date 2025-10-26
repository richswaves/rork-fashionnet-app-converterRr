-- ============================================================================
-- RLS POLICIES FOR PROFILES TABLE
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- First, enable RLS on profiles table if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update account status" ON profiles;

-- ============================================================================
-- SELECT POLICIES
-- ============================================================================

-- Everyone can view all profiles (public profiles)
CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT
USING (true);

-- ============================================================================
-- INSERT POLICIES
-- ============================================================================

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- UPDATE POLICIES
-- ============================================================================

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can update any profile (requires has_role function)
CREATE POLICY "Admins can update any profile"
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- ============================================================================
-- HELPER FUNCTION (if not already exists)
-- ============================================================================

-- Create has_role function if it doesn't exist
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role::text
  );
$$;

-- ============================================================================
-- ENSURE USER_ROLES TABLE EXISTS
-- ============================================================================

-- Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles" ON user_roles
FOR SELECT USING (auth.uid() = user_id);

-- Only admins can insert/update roles
CREATE POLICY "Admins can manage roles" ON user_roles
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- ============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- ============================================================================

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, username, account_status, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      'user_' || substr(NEW.id::text, 1, 8)
    ),
    'pending',
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO anon, authenticated;
GRANT SELECT ON user_roles TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (run these to check if everything works)
-- ============================================================================

-- Check if RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'user_roles');

-- Check existing policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename IN ('profiles', 'user_roles');
