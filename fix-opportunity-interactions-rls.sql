-- Fix RLS policy for opportunity_interactions table
-- This resolves the error: "new row violates row-level security policy for table opportunity_interactions"

-- Drop existing policy
DROP POLICY IF EXISTS "Users can insert their own opportunity interactions" ON public.opportunity_interactions;

-- Create new policy that allows:
-- 1. Authenticated users to insert their own interactions
-- 2. Anonymous users to insert interactions (for tracking purposes)
CREATE POLICY "Users can insert opportunity interactions" 
  ON public.opportunity_interactions 
  FOR INSERT 
  WITH CHECK (
    -- Allow if user is authenticated and inserting their own interaction
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR
    -- Allow if user is anonymous/not authenticated (user_id will be NULL)
    (auth.uid() IS NULL AND user_id IS NULL)
    OR
    -- Allow if authenticated user is inserting with their own user_id
    (auth.uid() = user_id)
  );

-- Grant INSERT permission to both authenticated and anonymous users
GRANT INSERT ON public.opportunity_interactions TO authenticated;
GRANT INSERT ON public.opportunity_interactions TO anon;
