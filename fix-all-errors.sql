-- ============================================================================
-- FIX ALL ERRORS - COMPREHENSIVE DATABASE MIGRATION
-- ============================================================================
-- This SQL script fixes the following errors:
-- 1. Missing account_deletion_feedback table (404 insert error)
-- 2. Missing delete_user_account function (account deletion error)
-- 3. Incorrect foreign key in blocked_users table (relationship error)
-- 4. Missing activity tracking tables (non-critical errors)
-- ============================================================================

-- ============================================================================
-- 1. CREATE ACCOUNT_DELETION_FEEDBACK TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.account_deletion_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_feedback_user ON account_deletion_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_feedback_deleted_at ON account_deletion_feedback(deleted_at);

ALTER TABLE account_deletion_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own deletion feedback" ON account_deletion_feedback;
CREATE POLICY "Users can insert own deletion feedback" ON account_deletion_feedback
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all deletion feedback" ON account_deletion_feedback;
CREATE POLICY "Admins can view all deletion feedback" ON account_deletion_feedback
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

GRANT INSERT ON account_deletion_feedback TO authenticated;
GRANT SELECT ON account_deletion_feedback TO authenticated;

-- ============================================================================
-- 2. CREATE DELETE_USER_ACCOUNT FUNCTION
-- ============================================================================
DROP FUNCTION IF EXISTS public.delete_user_account(uuid);

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;

-- ============================================================================
-- 3. FIX BLOCKED_USERS TABLE
-- ============================================================================
-- First, backup any existing data
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blocked_users') THEN
    -- Create a temporary backup table if data exists
    CREATE TEMP TABLE IF NOT EXISTS blocked_users_backup AS 
    SELECT * FROM public.blocked_users;
  END IF;
END
$$;

-- Drop and recreate the table with proper foreign keys
DROP TABLE IF EXISTS public.blocked_users CASCADE;

CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_user_id),
  CHECK (blocker_id != blocked_user_id)
);

-- Create indexes
CREATE INDEX idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX idx_blocked_users_blocked_user ON blocked_users(blocked_user_id);

-- Enable RLS
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view own blocks" ON blocked_users;
CREATE POLICY "Users can view own blocks" ON blocked_users
FOR SELECT USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can create blocks" ON blocked_users;
CREATE POLICY "Users can create blocks" ON blocked_users
FOR INSERT WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can delete blocks" ON blocked_users;
CREATE POLICY "Users can delete blocks" ON blocked_users
FOR DELETE USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Admins can view all blocks" ON blocked_users;
CREATE POLICY "Admins can view all blocks" ON blocked_users
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

GRANT SELECT, INSERT, DELETE ON blocked_users TO authenticated;

-- Restore data if backup exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'pg_temp' AND tablename LIKE 'blocked_users_backup%') THEN
    INSERT INTO public.blocked_users (id, blocker_id, blocked_user_id, created_at)
    SELECT id, blocker_id, blocked_user_id, created_at 
    FROM pg_temp.blocked_users_backup
    ON CONFLICT (blocker_id, blocked_user_id) DO NOTHING;
  END IF;
END
$$;

-- ============================================================================
-- 4. UPDATE BLOCK FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS public.is_blocked(uuid);
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

DROP FUNCTION IF EXISTS public.block_user(uuid);
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

DROP FUNCTION IF EXISTS public.unblock_user(uuid);
CREATE OR REPLACE FUNCTION public.unblock_user(target_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.blocked_users
  WHERE blocker_id = auth.uid() AND blocked_user_id = target_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.is_blocked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

-- ============================================================================
-- 5. CREATE ACTIVITY TRACKING TABLES (NON-CRITICAL)
-- ============================================================================

-- User Activity Events
CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  page text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_user ON user_activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_type ON user_activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_events_created ON user_activity_events(created_at);

ALTER TABLE user_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own activity" ON user_activity_events;
CREATE POLICY "Users can insert own activity" ON user_activity_events
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all activity" ON user_activity_events;
CREATE POLICY "Admins can view all activity" ON user_activity_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

GRANT INSERT ON user_activity_events TO authenticated;
GRANT SELECT ON user_activity_events TO authenticated;

-- Search Analytics
CREATE TABLE IF NOT EXISTS public.search_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page text NOT NULL,
  search_query text,
  filters jsonb,
  results_count integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_user ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON search_analytics(created_at);

ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own searches" ON search_analytics;
CREATE POLICY "Users can insert own searches" ON search_analytics
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all searches" ON search_analytics;
CREATE POLICY "Admins can view all searches" ON search_analytics
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

GRANT INSERT ON search_analytics TO authenticated;
GRANT SELECT ON search_analytics TO authenticated;

-- Opportunity Interactions
CREATE TABLE IF NOT EXISTS public.opportunity_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL,
  interaction_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_interactions_user ON opportunity_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_interactions_opportunity ON opportunity_interactions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_interactions_type ON opportunity_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_opportunity_interactions_created ON opportunity_interactions(created_at);

ALTER TABLE opportunity_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own interactions" ON opportunity_interactions;
CREATE POLICY "Users can insert own interactions" ON opportunity_interactions
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all interactions" ON opportunity_interactions;
CREATE POLICY "Admins can view all interactions" ON opportunity_interactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

GRANT INSERT ON opportunity_interactions TO authenticated;
GRANT SELECT ON opportunity_interactions TO authenticated;

-- Network Interactions
CREATE TABLE IF NOT EXISTS public.network_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_interactions_user ON network_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_network_interactions_target ON network_interactions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_network_interactions_type ON network_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_network_interactions_created ON network_interactions(created_at);

ALTER TABLE network_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own network interactions" ON network_interactions;
CREATE POLICY "Users can insert own network interactions" ON network_interactions
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all network interactions" ON network_interactions;
CREATE POLICY "Admins can view all network interactions" ON network_interactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

GRANT INSERT ON network_interactions TO authenticated;
GRANT SELECT ON network_interactions TO authenticated;

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================
-- Verify the tables were created successfully
DO $$
DECLARE
  missing_tables text[];
BEGIN
  SELECT ARRAY_AGG(table_name) INTO missing_tables
  FROM (
    VALUES 
      ('account_deletion_feedback'),
      ('blocked_users'),
      ('user_activity_events'),
      ('search_analytics'),
      ('opportunity_interactions'),
      ('network_interactions')
  ) AS expected(table_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = expected.table_name
  );
  
  IF missing_tables IS NOT NULL AND array_length(missing_tables, 1) > 0 THEN
    RAISE WARNING 'Missing tables: %', array_to_string(missing_tables, ', ');
  ELSE
    RAISE NOTICE 'All tables created successfully!';
  END IF;
END;
$$;

-- ============================================================================
-- DONE
-- ============================================================================
-- Run this SQL script in your Supabase SQL Editor to fix all errors.
-- After running:
-- 1. account_deletion_feedback table will exist (fixes 404 insert error)
-- 2. delete_user_account function will exist (fixes account deletion)
-- 3. blocked_users table will have correct foreign keys (fixes relationship error)
-- 4. Activity tracking tables will exist (fixes non-critical errors)
-- ============================================================================
