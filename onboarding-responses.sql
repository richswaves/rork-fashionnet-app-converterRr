-- ============================================================================
-- ONBOARDING RESPONSES TABLE
-- Run this SQL in your Supabase SQL Editor to create the onboarding responses table
-- ============================================================================

-- Create onboarding_responses table
CREATE TABLE IF NOT EXISTS public.onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  question TEXT NOT NULL,
  answer JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_user_id ON public.onboarding_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_role ON public.onboarding_responses(role);
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_question ON public.onboarding_responses(question);
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_created_at ON public.onboarding_responses(created_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own responses" ON public.onboarding_responses;
DROP POLICY IF EXISTS "Users can insert own responses" ON public.onboarding_responses;
DROP POLICY IF EXISTS "Users can update own responses" ON public.onboarding_responses;
DROP POLICY IF EXISTS "Admins can view all responses" ON public.onboarding_responses;

-- Users can view their own responses
CREATE POLICY "Users can view own responses" 
  ON public.onboarding_responses FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own responses
CREATE POLICY "Users can insert own responses" 
  ON public.onboarding_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own responses
CREATE POLICY "Users can update own responses" 
  ON public.onboarding_responses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all responses for analytics
CREATE POLICY "Admins can view all responses" 
  ON public.onboarding_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.onboarding_responses TO authenticated;
GRANT SELECT ON public.onboarding_responses TO anon;

-- ============================================================================
-- ONBOARDING STEP EVENTS TABLE (for funnel tracking)
-- ============================================================================

-- Create onboarding_step_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.onboarding_step_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  user_type TEXT,
  specific_role TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_events_session ON public.onboarding_step_events(session_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_user_id ON public.onboarding_step_events(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_step ON public.onboarding_step_events(step_number);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_created_at ON public.onboarding_step_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.onboarding_step_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own onboarding events" ON public.onboarding_step_events;
DROP POLICY IF EXISTS "Admins can view all onboarding events" ON public.onboarding_step_events;

-- Users can insert their own events
CREATE POLICY "Users can insert own onboarding events" 
  ON public.onboarding_step_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all events
CREATE POLICY "Admins can view all onboarding events" 
  ON public.onboarding_step_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Grant permissions
GRANT INSERT ON public.onboarding_step_events TO authenticated;
GRANT SELECT ON public.onboarding_step_events TO authenticated;

-- ============================================================================
-- HELPER FUNCTION: Get Question Analytics
-- ============================================================================

-- Function to aggregate question responses for analytics
CREATE OR REPLACE FUNCTION get_question_analytics()
RETURNS TABLE (
  role TEXT,
  question TEXT,
  answer_option TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.role,
    r.question,
    jsonb_array_elements_text(r.answer) as answer_option,
    COUNT(*) as count
  FROM public.onboarding_responses r
  WHERE jsonb_typeof(r.answer) = 'array'
  GROUP BY r.role, r.question, answer_option
  
  UNION ALL
  
  SELECT 
    r.role,
    r.question,
    r.answer::text as answer_option,
    COUNT(*) as count
  FROM public.onboarding_responses r
  WHERE jsonb_typeof(r.answer) = 'string'
  GROUP BY r.role, r.question, r.answer::text
  
  ORDER BY role, question, count DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_question_analytics() TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify tables were created
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('onboarding_responses', 'onboarding_step_events');

-- Verify policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd
FROM pg_policies 
WHERE tablename IN ('onboarding_responses', 'onboarding_step_events')
ORDER BY tablename, policyname;
