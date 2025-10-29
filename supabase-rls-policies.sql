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

-- ============================================================================
-- ADD SUSPENDED_AT FIELD TO PROFILES
-- ============================================================================

-- Add suspended_at column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- Update suspended_at for existing suspended accounts
UPDATE profiles 
SET suspended_at = CURRENT_TIMESTAMP 
WHERE account_status = 'suspended' AND suspended_at IS NULL;

-- Create trigger to automatically set suspended_at when account is suspended
CREATE OR REPLACE FUNCTION update_suspended_at()
RETURNS TRIGGER AS $
BEGIN
  IF NEW.account_status = 'suspended' AND OLD.account_status != 'suspended' THEN
    NEW.suspended_at = CURRENT_TIMESTAMP;
  ELSIF NEW.account_status != 'suspended' THEN
    NEW.suspended_at = NULL;
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_suspended_at ON profiles;
CREATE TRIGGER set_suspended_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_suspended_at();

-- ============================================================================
-- BLOCKED USERS TABLE
-- ============================================================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own blocks" ON blocked_users;
DROP POLICY IF EXISTS "Users can create blocks" ON blocked_users;
DROP POLICY IF EXISTS "Users can delete blocks" ON blocked_users;
DROP POLICY IF EXISTS "Admins can view all blocks" ON blocked_users;

-- Create blocked_users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_user_id),
  CHECK (blocker_id != blocked_user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_user ON blocked_users(blocked_user_id);

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

-- ============================================================================
-- BLOCK/UNBLOCK RPC FUNCTIONS AND TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_blocked(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = auth.uid() AND blocked_user_id = target_user_id
  );
$;

CREATE OR REPLACE FUNCTION public.block_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
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
$;

CREATE OR REPLACE FUNCTION public.unblock_user(target_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $
  DELETE FROM public.blocked_users
  WHERE blocker_id = auth.uid() AND blocked_user_id = target_user_id;
$;

GRANT EXECUTE ON FUNCTION public.is_blocked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

-- ============================================================================
-- REPORTS TABLE
-- ============================================================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own reports" ON reports;
DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON reports;
DROP POLICY IF EXISTS "Admins can update reports" ON reports;

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON reports
FOR SELECT USING (auth.uid() = reporter_id);

-- Users can create reports
CREATE POLICY "Users can create reports" ON reports
FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports" ON reports
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Admins can update reports
CREATE POLICY "Admins can update reports" ON reports
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON blocked_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON reports TO authenticated;

-- ============================================================================
-- APPEALS TABLE
-- ============================================================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own appeals" ON appeals;
DROP POLICY IF EXISTS "Users can create appeals" ON appeals;
DROP POLICY IF EXISTS "Admins can view all appeals" ON appeals;
DROP POLICY IF EXISTS "Admins can update appeals" ON appeals;

-- Create appeals table
CREATE TABLE IF NOT EXISTS public.appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, created_at)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_appeals_user ON appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);

-- Enable RLS
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;

-- Users can view their own appeals
CREATE POLICY "Users can view own appeals" ON appeals
FOR SELECT USING (auth.uid() = user_id);

-- Users can create appeals (suspended users only)
CREATE POLICY "Users can create appeals" ON appeals
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.account_status = 'suspended'
  )
);

-- Admins can view all appeals
CREATE POLICY "Admins can view all appeals" ON appeals
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Admins can update appeals
CREATE POLICY "Admins can update appeals" ON appeals
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Grant permissions
GRANT SELECT, INSERT ON appeals TO authenticated;
GRANT UPDATE ON appeals TO authenticated;

-- ============================================================================
-- ACCOUNT DELETION FEEDBACK TABLE
-- ============================================================================

-- Create account_deletion_feedback table
CREATE TABLE IF NOT EXISTS public.account_deletion_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  deleted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_deletion_feedback_user ON account_deletion_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_feedback_deleted_at ON account_deletion_feedback(deleted_at);

-- Enable RLS
ALTER TABLE account_deletion_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own deletion feedback" ON account_deletion_feedback
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all deletion feedback" ON account_deletion_feedback
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Grant permissions
GRANT INSERT ON account_deletion_feedback TO authenticated;
GRANT SELECT ON account_deletion_feedback TO authenticated;

-- ============================================================================
-- DELETE USER ACCOUNT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
  -- Verify user is deleting their own account
  IF target_user_id IS NULL OR target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You can only delete your own account';
  END IF;

  -- Delete user's data from various tables
  -- The CASCADE on auth.users will handle most related records
  -- but we explicitly delete from some tables for clarity
  
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  DELETE FROM public.blocked_users WHERE blocker_id = target_user_id OR blocked_user_id = target_user_id;
  DELETE FROM public.reports WHERE reporter_id = target_user_id OR reported_user_id = target_user_id;
  DELETE FROM public.appeals WHERE user_id = target_user_id;
  
  -- Delete tables that might exist
  IF to_regclass('public.follows') IS NOT NULL THEN
    DELETE FROM public.follows WHERE follower_id = target_user_id OR following_id = target_user_id;
  END IF;
  
  IF to_regclass('public.opportunities') IS NOT NULL THEN
    DELETE FROM public.opportunities WHERE user_id = target_user_id;
  END IF;
  
  IF to_regclass('public.applications') IS NOT NULL THEN
    DELETE FROM public.applications WHERE applicant_id = target_user_id;
  END IF;
  
  IF to_regclass('public.saved_opportunities') IS NOT NULL THEN
    DELETE FROM public.saved_opportunities WHERE user_id = target_user_id;
  END IF;
  
  IF to_regclass('public.portfolio_items') IS NOT NULL THEN
    DELETE FROM public.portfolio_items WHERE user_id = target_user_id;
  END IF;
  
  IF to_regclass('public.conversations') IS NOT NULL THEN
    DELETE FROM public.conversations WHERE participant_1 = target_user_id OR participant_2 = target_user_id;
  END IF;
  
  IF to_regclass('public.messages') IS NOT NULL THEN
    DELETE FROM public.messages WHERE sender_id = target_user_id;
  END IF;

  -- Finally delete the auth user (this will cascade to remaining tables)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$;

GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;

-- ============================================================================
-- FOLLOWS TABLE
-- ============================================================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view all follows" ON follows;
DROP POLICY IF EXISTS "Users can create follows" ON follows;
DROP POLICY IF EXISTS "Users can delete own follows" ON follows;

-- Create follows table
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON follows(created_at DESC);

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Everyone can view all follows (public)
CREATE POLICY "Users can view all follows" ON follows
FOR SELECT USING (true);

-- Users can create their own follows
CREATE POLICY "Users can create follows" ON follows
FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can delete their own follows
CREATE POLICY "Users can delete own follows" ON follows
FOR DELETE USING (auth.uid() = follower_id);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON follows TO authenticated;
GRANT SELECT ON follows TO anon;

-- ============================================================================
-- OPPORTUNITIES TABLE (if not exists)
-- ============================================================================

-- Create opportunities table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  location text,
  compensation text,
  requirements text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_opportunities_user ON opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON opportunities(created_at DESC);

-- Enable RLS
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all active opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can view own opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can create opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can update own opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can delete own opportunities" ON opportunities;

-- Everyone can view active opportunities
CREATE POLICY "Users can view all active opportunities" ON opportunities
FOR SELECT USING (status = 'active' OR user_id = auth.uid());

-- Users can create their own opportunities
CREATE POLICY "Users can create opportunities" ON opportunities
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own opportunities
CREATE POLICY "Users can update own opportunities" ON opportunities
FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own opportunities
CREATE POLICY "Users can delete own opportunities" ON opportunities
FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT ON opportunities TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON opportunities TO authenticated;

-- ============================================================================
-- APPLICATIONS TABLE
-- ============================================================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view applications for their opportunities" ON applications;
DROP POLICY IF EXISTS "Users can view their own applications" ON applications;
DROP POLICY IF EXISTS "Users can create applications" ON applications;
DROP POLICY IF EXISTS "Users can update own applications" ON applications;
DROP POLICY IF EXISTS "Users can delete own applications" ON applications;

-- Create applications table
CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(opportunity_id, applicant_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_applications_opportunity ON applications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);

-- Enable RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Users can view applications for their opportunities
CREATE POLICY "Users can view applications for their opportunities" ON applications
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM opportunities 
    WHERE opportunities.id = applications.opportunity_id 
    AND opportunities.user_id = auth.uid()
  ) OR applicant_id = auth.uid()
);

-- Users can create applications
CREATE POLICY "Users can create applications" ON applications
FOR INSERT WITH CHECK (auth.uid() = applicant_id);

-- Users can update their own applications
CREATE POLICY "Users can update own applications" ON applications
FOR UPDATE USING (auth.uid() = applicant_id);

-- Users can delete their own applications
CREATE POLICY "Users can delete own applications" ON applications
FOR DELETE USING (auth.uid() = applicant_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON applications TO authenticated;

-- ============================================================================
-- APPLICANT NOTIFICATIONS TABLE
-- ============================================================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "System can insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Users can update own applicant notifications" ON applicant_notifications;

-- Create applicant_notifications table
CREATE TABLE IF NOT EXISTS public.applicant_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  related_id uuid,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_applicant_notifications_applicant ON applicant_notifications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applicant_notifications_created_at ON applicant_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applicant_notifications_read ON applicant_notifications(read);

-- Enable RLS
ALTER TABLE applicant_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own applicant notifications" ON applicant_notifications
FOR SELECT USING (auth.uid() = applicant_id);

-- Opportunity owners can create notifications (when approving/rejecting)
CREATE POLICY "Opportunity owners can insert applicant notifications" ON applicant_notifications
FOR INSERT WITH CHECK (
  -- Admins can create notifications for profile approvals/rejections
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
  OR
  -- Opportunity owners can create notifications when approving/rejecting applications
  (
    related_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM applications a
      JOIN opportunities o ON o.id = a.opportunity_id
      WHERE a.id = related_id
      AND o.user_id = auth.uid()
      AND a.applicant_id = applicant_id
    )
  )
);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own applicant notifications" ON applicant_notifications
FOR UPDATE USING (auth.uid() = applicant_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON applicant_notifications TO authenticated;
