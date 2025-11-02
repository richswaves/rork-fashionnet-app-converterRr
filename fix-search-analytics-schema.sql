-- ================================================
-- FIX SEARCH ANALYTICS SCHEMA CACHE ISSUE
-- ================================================
-- This script ensures the results_count column exists
-- and forces PostgREST to reload the schema cache

-- First, ensure the search_analytics table exists with all columns
CREATE TABLE IF NOT EXISTS public.search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  page TEXT NOT NULL,
  search_query TEXT,
  filters JSONB,
  results_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add the results_count column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'search_analytics' 
    AND column_name = 'results_count'
  ) THEN
    ALTER TABLE public.search_analytics ADD COLUMN results_count INTEGER;
    RAISE NOTICE 'Added results_count column to search_analytics';
  ELSE
    RAISE NOTICE 'results_count column already exists';
  END IF;
END$$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_search_analytics_user_id ON public.search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_page ON public.search_analytics(page);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON public.search_analytics(created_at DESC);

-- Ensure RLS is enabled
ALTER TABLE public.search_analytics ENABLE ROW LEVEL SECURITY;

-- Recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Users can insert their own search analytics" ON public.search_analytics;
CREATE POLICY "Users can insert their own search analytics"
  ON public.search_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all search analytics" ON public.search_analytics;
CREATE POLICY "Admins can view all search analytics"
  ON public.search_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Force PostgREST to reload schema cache
-- This is done by sending a NOTIFY signal
NOTIFY pgrst, 'reload schema';

-- Confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Search analytics schema fixed!';
  RAISE NOTICE 'The results_count column is now available.';
  RAISE NOTICE 'PostgREST schema cache has been notified to reload.';
END$$;
