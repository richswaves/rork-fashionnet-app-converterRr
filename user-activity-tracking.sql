-- User Activity Tracking Tables
-- Run this SQL in your Supabase SQL Editor to create the tracking tables

-- ========================================
-- 1. USER ACTIVITY EVENTS TABLE
-- Tracks all user interactions across the platform
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  page TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_events_user_id ON public.user_activity_events(user_id);
CREATE INDEX idx_activity_events_event_type ON public.user_activity_events(event_type);
CREATE INDEX idx_activity_events_page ON public.user_activity_events(page);
CREATE INDEX idx_activity_events_created_at ON public.user_activity_events(created_at DESC);

-- ========================================
-- 2. SEARCH ANALYTICS TABLE
-- Tracks search queries and filters used
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

CREATE INDEX idx_search_analytics_user_id ON public.search_analytics(user_id);
CREATE INDEX idx_search_analytics_page ON public.search_analytics(page);
CREATE INDEX idx_search_analytics_created_at ON public.search_analytics(created_at DESC);
CREATE INDEX idx_search_analytics_query ON public.search_analytics USING gin(to_tsvector('english', search_query));

-- ========================================
-- 3. OPPORTUNITY INTERACTIONS TABLE
-- Tracks interactions with opportunities (views, applications, saves)
-- ========================================
CREATE TABLE IF NOT EXISTS public.opportunity_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_opportunity_interactions_user_id ON public.opportunity_interactions(user_id);
CREATE INDEX idx_opportunity_interactions_opportunity_id ON public.opportunity_interactions(opportunity_id);
CREATE INDEX idx_opportunity_interactions_type ON public.opportunity_interactions(interaction_type);
CREATE INDEX idx_opportunity_interactions_created_at ON public.opportunity_interactions(created_at DESC);

-- ========================================
-- 4. NETWORK INTERACTIONS TABLE  
-- Tracks interactions on the network page (profile views, follows)
-- ========================================
CREATE TABLE IF NOT EXISTS public.network_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_network_interactions_user_id ON public.network_interactions(user_id);
CREATE INDEX idx_network_interactions_target_user_id ON public.network_interactions(target_user_id);
CREATE INDEX idx_network_interactions_type ON public.network_interactions(interaction_type);
CREATE INDEX idx_network_interactions_created_at ON public.network_interactions(created_at DESC);

-- ========================================
-- RLS POLICIES
-- ========================================

ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_interactions ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own activity
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

-- Admins can view all activity
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
-- HELPER FUNCTIONS
-- ========================================

-- Function to get user activity summary
CREATE OR REPLACE FUNCTION get_user_activity_summary(target_user_id UUID, days_back INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_events', COUNT(*),
    'pages_visited', COUNT(DISTINCT page),
    'event_types', jsonb_agg(DISTINCT event_type),
    'most_active_page', (
      SELECT page FROM user_activity_events
      WHERE user_id = target_user_id
      AND created_at >= now() - (days_back || ' days')::interval
      GROUP BY page
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    'last_active', MAX(created_at)
  ) INTO result
  FROM user_activity_events
  WHERE user_id = target_user_id
  AND created_at >= now() - (days_back || ' days')::interval;
  
  RETURN result;
END;
$$;

-- Function to get search patterns
CREATE OR REPLACE FUNCTION get_search_patterns(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  page TEXT,
  search_query TEXT,
  search_count BIGINT,
  avg_results INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.page,
    s.search_query,
    COUNT(*) as search_count,
    ROUND(AVG(s.results_count))::INTEGER as avg_results
  FROM search_analytics s
  WHERE s.created_at >= now() - (days_back || ' days')::interval
  AND s.search_query IS NOT NULL
  AND s.search_query != ''
  GROUP BY s.page, s.search_query
  ORDER BY search_count DESC
  LIMIT 50;
END;
$$;

-- Function to get filter usage statistics
CREATE OR REPLACE FUNCTION get_filter_usage_stats(target_page TEXT, days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  filter_key TEXT,
  filter_value TEXT,
  usage_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.key as filter_key,
    f.value::text as filter_value,
    COUNT(*) as usage_count
  FROM search_analytics s,
  LATERAL jsonb_each(s.filters) as f(key, value)
  WHERE s.page = target_page
  AND s.created_at >= now() - (days_back || ' days')::interval
  AND s.filters IS NOT NULL
  GROUP BY f.key, f.value::text
  ORDER BY usage_count DESC;
END;
$$;

-- Function to get opportunity interaction stats
CREATE OR REPLACE FUNCTION get_opportunity_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  opportunity_id UUID,
  title TEXT,
  view_count BIGINT,
  application_count BIGINT,
  save_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oi.opportunity_id,
    o.title,
    COUNT(*) FILTER (WHERE oi.interaction_type = 'view') as view_count,
    COUNT(*) FILTER (WHERE oi.interaction_type = 'apply') as application_count,
    COUNT(*) FILTER (WHERE oi.interaction_type = 'save') as save_count
  FROM opportunity_interactions oi
  LEFT JOIN opportunities o ON o.id = oi.opportunity_id
  WHERE oi.created_at >= now() - (days_back || ' days')::interval
  GROUP BY oi.opportunity_id, o.title
  ORDER BY view_count DESC, application_count DESC
  LIMIT 100;
END;
$$;

-- Function to get location interaction stats
CREATE OR REPLACE FUNCTION get_location_stats(target_page TEXT, days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  location TEXT,
  interaction_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (s.filters->>'location')::text as location,
    COUNT(*) as interaction_count
  FROM search_analytics s
  WHERE s.page = target_page
  AND s.created_at >= now() - (days_back || ' days')::interval
  AND s.filters->>'location' IS NOT NULL
  GROUP BY location
  ORDER BY interaction_count DESC;
END;
$$;
