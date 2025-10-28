-- ===========================================
-- ACTIVITY TRACKING TABLES MIGRATION
-- Run this in your Supabase SQL Editor
-- ===========================================
-- This creates tables needed for the activity tracking feature
-- If tables already exist, this script will skip them safely

-- ========================================
-- 1. USER ACTIVITY EVENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  page TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_events_user_id ON public.user_activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_event_type ON public.user_activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_events_page ON public.user_activity_events(page);
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON public.user_activity_events(created_at DESC);

-- ========================================
-- 2. SEARCH ANALYTICS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  page TEXT NOT NULL,
  search_query TEXT,
  filters JSONB,
  results_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_analytics_user_id ON public.search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_page ON public.search_analytics(page);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON public.search_analytics(created_at DESC);

-- Full-text search index (skip if it fails - GIN indexes can have naming conflicts)
DO $$
BEGIN
  CREATE INDEX idx_search_analytics_query ON public.search_analytics USING gin(to_tsvector('english', search_query));
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'Index idx_search_analytics_query already exists, skipping';
END$$;

-- ========================================
-- 3. OPPORTUNITY INTERACTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.opportunity_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_opportunity_interactions_user_id ON public.opportunity_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_interactions_opportunity_id ON public.opportunity_interactions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_interactions_type ON public.opportunity_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_opportunity_interactions_created_at ON public.opportunity_interactions(created_at DESC);

-- ========================================
-- 4. NETWORK INTERACTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.network_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_network_interactions_user_id ON public.network_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_network_interactions_target_user_id ON public.network_interactions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_network_interactions_type ON public.network_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_network_interactions_created_at ON public.network_interactions(created_at DESC);

-- ========================================
-- ENABLE RLS (ROW LEVEL SECURITY)
-- ========================================
ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_interactions ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES - USER INSERT PERMISSIONS
-- ========================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert their own activity events" ON public.user_activity_events;
DROP POLICY IF EXISTS "Users can insert their own search analytics" ON public.search_analytics;
DROP POLICY IF EXISTS "Users can insert their own opportunity interactions" ON public.opportunity_interactions;
DROP POLICY IF EXISTS "Users can insert their own network interactions" ON public.network_interactions;

-- Create INSERT policies (users can track their own activity)
CREATE POLICY "Users can insert their own activity events"
  ON public.user_activity_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search analytics"
  ON public.search_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own opportunity interactions"
  ON public.opportunity_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own network interactions"
  ON public.network_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ========================================
-- RLS POLICIES - ADMIN SELECT PERMISSIONS
-- ========================================

-- Drop existing admin policies if they exist
DROP POLICY IF EXISTS "Admins can view all activity events" ON public.user_activity_events;
DROP POLICY IF EXISTS "Admins can view all search analytics" ON public.search_analytics;
DROP POLICY IF EXISTS "Admins can view all opportunity interactions" ON public.opportunity_interactions;
DROP POLICY IF EXISTS "Admins can view all network interactions" ON public.network_interactions;

-- Create SELECT policies (admins can view all activity)
CREATE POLICY "Admins can view all activity events"
  ON public.user_activity_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view all search analytics"
  ON public.search_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view all opportunity interactions"
  ON public.opportunity_interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view all network interactions"
  ON public.network_interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ========================================
-- CONFIRMATION MESSAGE
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '✅ Activity tracking tables created successfully!';
  RAISE NOTICE 'Tables created: user_activity_events, search_analytics, opportunity_interactions, network_interactions';
  RAISE NOTICE 'All indexes and RLS policies are in place.';
END$$;
