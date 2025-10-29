-- ===========================================
-- COMPREHENSIVE USER ANALYTICS TRACKING
-- Run this in your Supabase SQL Editor
-- ===========================================
-- This adds enhanced analytics for:
-- 1. User searches
-- 2. Filter usage on event and network pages
-- 3. Most followed roles
-- 4. Top users at each position
-- 5. Opportunity type traction
-- ===========================================

-- ========================================
-- 1. ENHANCED SEARCH TRACKING
-- ========================================
-- Add more columns to search_analytics if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_analytics' AND column_name = 'clicked_result_id') THEN
    ALTER TABLE public.search_analytics ADD COLUMN clicked_result_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_analytics' AND column_name = 'time_spent_seconds') THEN
    ALTER TABLE public.search_analytics ADD COLUMN time_spent_seconds INTEGER;
  END IF;
END$$;

-- ========================================
-- 2. ROLE FOLLOWING TRACKING TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.role_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_role_follows_user_id ON public.role_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_role_follows_role_name ON public.role_follows(role_name);
CREATE INDEX IF NOT EXISTS idx_role_follows_created_at ON public.role_follows(created_at DESC);

-- Enable RLS
ALTER TABLE public.role_follows ENABLE ROW LEVEL SECURITY;

-- Users can insert/delete their own role follows
DROP POLICY IF EXISTS "Users can manage their own role follows" ON public.role_follows;
CREATE POLICY "Users can manage their own role follows"
  ON public.role_follows FOR ALL
  USING (auth.uid() = user_id);

-- Admins can view all role follows
DROP POLICY IF EXISTS "Admins can view all role follows" ON public.role_follows;
CREATE POLICY "Admins can view all role follows"
  ON public.role_follows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ========================================
-- 3. OPPORTUNITY TYPE TRACKING
-- ========================================
-- Add opportunity_type column to opportunity_interactions if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'opportunity_interactions' AND column_name = 'opportunity_type') THEN
    ALTER TABLE public.opportunity_interactions ADD COLUMN opportunity_type TEXT;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_opportunity_interactions_type_tracking ON public.opportunity_interactions(opportunity_type);

-- ========================================
-- 4. USER POSITION TRACKING
-- ========================================
-- This assumes profiles table has a 'position' or 'role' column
-- Add position_viewed column to network_interactions for tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'network_interactions' AND column_name = 'target_user_position') THEN
    ALTER TABLE public.network_interactions ADD COLUMN target_user_position TEXT;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_network_interactions_position ON public.network_interactions(target_user_position);

-- ========================================
-- ANALYTICS FUNCTIONS
-- ========================================

-- Function: Get most searched terms
CREATE OR REPLACE FUNCTION get_top_searches(
  target_page TEXT DEFAULT NULL,
  days_back INTEGER DEFAULT 30,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  search_query TEXT,
  search_count BIGINT,
  avg_results NUMERIC,
  pages_used TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.search_query,
    COUNT(*) as search_count,
    ROUND(AVG(s.results_count), 2) as avg_results,
    ARRAY_AGG(DISTINCT s.page) as pages_used
  FROM search_analytics s
  WHERE s.created_at >= now() - (days_back || ' days')::interval
  AND s.search_query IS NOT NULL
  AND s.search_query != ''
  AND (target_page IS NULL OR s.page = target_page)
  GROUP BY s.search_query
  ORDER BY search_count DESC
  LIMIT limit_count;
END;
$$;

-- Function: Get filter usage statistics by page
CREATE OR REPLACE FUNCTION get_filter_usage_by_page(
  target_page TEXT,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  filter_key TEXT,
  filter_value TEXT,
  usage_count BIGINT,
  percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_searches BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_searches
  FROM search_analytics
  WHERE page = target_page
  AND created_at >= now() - (days_back || ' days')::interval
  AND filters IS NOT NULL;
  
  RETURN QUERY
  SELECT 
    f.key as filter_key,
    f.value::text as filter_value,
    COUNT(*) as usage_count,
    ROUND((COUNT(*)::NUMERIC / NULLIF(total_searches, 0)) * 100, 2) as percentage
  FROM search_analytics s,
  LATERAL jsonb_each(s.filters) as f(key, value)
  WHERE s.page = target_page
  AND s.created_at >= now() - (days_back || ' days')::interval
  AND s.filters IS NOT NULL
  GROUP BY f.key, f.value::text
  ORDER BY usage_count DESC;
END;
$$;

-- Function: Get most followed roles
CREATE OR REPLACE FUNCTION get_most_followed_roles(
  days_back INTEGER DEFAULT 30,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  role_name TEXT,
  follower_count BIGINT,
  new_followers_this_period BIGINT,
  growth_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH current_period AS (
    SELECT 
      rf.role_name,
      COUNT(*) as total_followers,
      COUNT(*) FILTER (WHERE rf.created_at >= now() - (days_back || ' days')::interval) as new_followers
    FROM role_follows rf
    GROUP BY rf.role_name
  )
  SELECT 
    cp.role_name,
    cp.total_followers as follower_count,
    cp.new_followers as new_followers_this_period,
    ROUND(
      (cp.new_followers::NUMERIC / NULLIF(cp.total_followers - cp.new_followers, 0)) * 100, 
      2
    ) as growth_rate
  FROM current_period cp
  ORDER BY cp.total_followers DESC, cp.new_followers DESC
  LIMIT limit_count;
END;
$$;

-- Function: Get top users by position
CREATE OR REPLACE FUNCTION get_top_users_by_position(
  target_position TEXT DEFAULT NULL,
  days_back INTEGER DEFAULT 30,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  position TEXT,
  profile_views BIGINT,
  follows BIGINT,
  engagement_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    p.position,
    COUNT(*) FILTER (WHERE ni.interaction_type = 'profile_view') as profile_views,
    COUNT(*) FILTER (WHERE ni.interaction_type = 'follow') as follows,
    (
      COUNT(*) FILTER (WHERE ni.interaction_type = 'profile_view') * 1.0 +
      COUNT(*) FILTER (WHERE ni.interaction_type = 'follow') * 5.0 +
      COUNT(*) FILTER (WHERE ni.interaction_type = 'message') * 3.0
    ) as engagement_score
  FROM profiles p
  LEFT JOIN network_interactions ni ON ni.target_user_id = p.user_id
    AND ni.created_at >= now() - (days_back || ' days')::interval
  WHERE p.position IS NOT NULL
  AND (target_position IS NULL OR p.position = target_position)
  GROUP BY p.user_id, p.full_name, p.position
  ORDER BY engagement_score DESC, profile_views DESC
  LIMIT limit_count;
END;
$$;

-- Function: Get opportunity type traction
CREATE OR REPLACE FUNCTION get_opportunity_type_traction(
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  opportunity_type TEXT,
  total_opportunities BIGINT,
  total_views BIGINT,
  total_applications BIGINT,
  total_saves BIGINT,
  avg_views_per_opportunity NUMERIC,
  application_rate NUMERIC,
  save_rate NUMERIC,
  engagement_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.type as opportunity_type,
    COUNT(DISTINCT o.id) as total_opportunities,
    COUNT(*) FILTER (WHERE oi.interaction_type = 'view') as total_views,
    COUNT(*) FILTER (WHERE oi.interaction_type = 'apply') as total_applications,
    COUNT(*) FILTER (WHERE oi.interaction_type = 'save') as total_saves,
    ROUND(
      COUNT(*) FILTER (WHERE oi.interaction_type = 'view')::NUMERIC / 
      NULLIF(COUNT(DISTINCT o.id), 0), 
      2
    ) as avg_views_per_opportunity,
    ROUND(
      (COUNT(*) FILTER (WHERE oi.interaction_type = 'apply')::NUMERIC / 
      NULLIF(COUNT(*) FILTER (WHERE oi.interaction_type = 'view'), 0)) * 100, 
      2
    ) as application_rate,
    ROUND(
      (COUNT(*) FILTER (WHERE oi.interaction_type = 'save')::NUMERIC / 
      NULLIF(COUNT(*) FILTER (WHERE oi.interaction_type = 'view'), 0)) * 100, 
      2
    ) as save_rate,
    (
      COUNT(*) FILTER (WHERE oi.interaction_type = 'view') * 1.0 +
      COUNT(*) FILTER (WHERE oi.interaction_type = 'apply') * 10.0 +
      COUNT(*) FILTER (WHERE oi.interaction_type = 'save') * 3.0
    ) as engagement_score
  FROM opportunities o
  LEFT JOIN opportunity_interactions oi ON oi.opportunity_id = o.id
    AND oi.created_at >= now() - (days_back || ' days')::interval
  WHERE o.type IS NOT NULL
  AND o.created_at >= now() - (days_back || ' days')::interval
  GROUP BY o.type
  ORDER BY engagement_score DESC, total_views DESC;
END;
$$;

-- Function: Get all positions with stats
CREATE OR REPLACE FUNCTION get_positions_with_stats(
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  position TEXT,
  total_users BIGINT,
  active_users BIGINT,
  total_views BIGINT,
  avg_views_per_user NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.position,
    COUNT(DISTINCT p.user_id) as total_users,
    COUNT(DISTINCT CASE 
      WHEN ni.created_at >= now() - (days_back || ' days')::interval 
      THEN ni.target_user_id 
    END) as active_users,
    COUNT(*) FILTER (WHERE ni.interaction_type = 'profile_view') as total_views,
    ROUND(
      COUNT(*) FILTER (WHERE ni.interaction_type = 'profile_view')::NUMERIC / 
      NULLIF(COUNT(DISTINCT p.user_id), 0), 
      2
    ) as avg_views_per_user
  FROM profiles p
  LEFT JOIN network_interactions ni ON ni.target_user_id = p.user_id
  WHERE p.position IS NOT NULL
  GROUP BY p.position
  ORDER BY total_users DESC, total_views DESC;
END;
$$;

-- Function: Get comprehensive analytics dashboard data
CREATE OR REPLACE FUNCTION get_comprehensive_analytics(
  days_back INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'search_analytics', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT * FROM get_top_searches(NULL, days_back, 20)
      ) t
    ),
    'most_followed_roles', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT * FROM get_most_followed_roles(days_back, 20)
      ) t
    ),
    'opportunity_type_traction', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT * FROM get_opportunity_type_traction(days_back)
      ) t
    ),
    'positions_stats', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT * FROM get_positions_with_stats(days_back)
      ) t
    ),
    'network_page_filters', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT * FROM get_filter_usage_by_page('network', days_back)
      ) t
    ),
    'opportunities_page_filters', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT * FROM get_filter_usage_by_page('opportunities', days_back)
      ) t
    ),
    'generated_at', now()
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function: Get user search history (for individual user analytics)
CREATE OR REPLACE FUNCTION get_user_search_history(
  target_user_id UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  search_query TEXT,
  page TEXT,
  filters JSONB,
  results_count INTEGER,
  searched_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.search_query,
    sa.page,
    sa.filters,
    sa.results_count,
    sa.created_at as searched_at
  FROM search_analytics sa
  WHERE sa.user_id = target_user_id
  AND sa.created_at >= now() - (days_back || ' days')::interval
  ORDER BY sa.created_at DESC
  LIMIT 100;
END;
$$;

-- Function: Get user interaction history
CREATE OR REPLACE FUNCTION get_user_interaction_history(
  target_user_id UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  interaction_type TEXT,
  interaction_count BIGINT,
  pages TEXT[],
  last_interaction TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uae.event_type as interaction_type,
    COUNT(*) as interaction_count,
    ARRAY_AGG(DISTINCT uae.page) as pages,
    MAX(uae.created_at) as last_interaction
  FROM user_activity_events uae
  WHERE uae.user_id = target_user_id
  AND uae.created_at >= now() - (days_back || ' days')::interval
  GROUP BY uae.event_type
  ORDER BY interaction_count DESC;
END;
$$;

-- ========================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ========================================

-- Materialized view for popular opportunities
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_opportunities AS
SELECT 
  o.id,
  o.title,
  o.type,
  o.company,
  COUNT(*) FILTER (WHERE oi.interaction_type = 'view') as view_count,
  COUNT(*) FILTER (WHERE oi.interaction_type = 'apply') as application_count,
  COUNT(*) FILTER (WHERE oi.interaction_type = 'save') as save_count,
  (
    COUNT(*) FILTER (WHERE oi.interaction_type = 'view') * 1.0 +
    COUNT(*) FILTER (WHERE oi.interaction_type = 'apply') * 10.0 +
    COUNT(*) FILTER (WHERE oi.interaction_type = 'save') * 3.0
  ) as engagement_score,
  MAX(oi.created_at) as last_interaction
FROM opportunities o
LEFT JOIN opportunity_interactions oi ON oi.opportunity_id = o.id
GROUP BY o.id, o.title, o.type, o.company;

CREATE UNIQUE INDEX IF NOT EXISTS idx_popular_opportunities_id ON popular_opportunities(id);
CREATE INDEX IF NOT EXISTS idx_popular_opportunities_score ON popular_opportunities(engagement_score DESC);

-- Materialized view for popular users
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_users AS
SELECT 
  p.user_id,
  p.full_name,
  p.position,
  p.location,
  COUNT(*) FILTER (WHERE ni.interaction_type = 'profile_view') as view_count,
  COUNT(*) FILTER (WHERE ni.interaction_type = 'follow') as follow_count,
  (
    COUNT(*) FILTER (WHERE ni.interaction_type = 'profile_view') * 1.0 +
    COUNT(*) FILTER (WHERE ni.interaction_type = 'follow') * 5.0
  ) as engagement_score,
  MAX(ni.created_at) as last_interaction
FROM profiles p
LEFT JOIN network_interactions ni ON ni.target_user_id = p.user_id
GROUP BY p.user_id, p.full_name, p.position, p.location;

CREATE UNIQUE INDEX IF NOT EXISTS idx_popular_users_id ON popular_users(user_id);
CREATE INDEX IF NOT EXISTS idx_popular_users_score ON popular_users(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_popular_users_position ON popular_users(position);

-- Function to refresh materialized views (call this periodically)
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY popular_opportunities;
  REFRESH MATERIALIZED VIEW CONCURRENTLY popular_users;
END;
$$;

-- ========================================
-- CONFIRMATION MESSAGE
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '✅ Comprehensive user analytics setup complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Available Functions:';
  RAISE NOTICE '  • get_top_searches(page, days_back, limit)';
  RAISE NOTICE '  • get_filter_usage_by_page(page, days_back)';
  RAISE NOTICE '  • get_most_followed_roles(days_back, limit)';
  RAISE NOTICE '  • get_top_users_by_position(position, days_back, limit)';
  RAISE NOTICE '  • get_opportunity_type_traction(days_back)';
  RAISE NOTICE '  • get_positions_with_stats(days_back)';
  RAISE NOTICE '  • get_comprehensive_analytics(days_back)';
  RAISE NOTICE '  • get_user_search_history(user_id, days_back)';
  RAISE NOTICE '  • get_user_interaction_history(user_id, days_back)';
  RAISE NOTICE '  • refresh_analytics_views()';
  RAISE NOTICE '';
  RAISE NOTICE 'Materialized Views:';
  RAISE NOTICE '  • popular_opportunities';
  RAISE NOTICE '  • popular_users';
  RAISE NOTICE '';
  RAISE NOTICE 'Remember to call refresh_analytics_views() periodically to update cached data!';
END$$;
