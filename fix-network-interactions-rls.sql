-- FIX NETWORK_INTERACTIONS RLS POLICY
-- This fixes the 42501 RLS error when users insert network interactions

-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "Users can insert own network interactions" ON network_interactions;
DROP POLICY IF EXISTS "Admins can view all network interactions" ON network_interactions;
DROP POLICY IF EXISTS "Users can view own network interactions" ON network_interactions;

-- Step 2: Create comprehensive RLS policies

-- Allow users to insert their own network interactions
CREATE POLICY "Users can insert own network interactions" ON network_interactions
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own network interactions
CREATE POLICY "Users can view own network interactions" ON network_interactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = target_user_id);

-- Allow admins to view all network interactions
CREATE POLICY "Admins can view all network interactions" ON network_interactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Step 3: Ensure grants are in place
GRANT INSERT ON network_interactions TO authenticated;
GRANT SELECT ON network_interactions TO authenticated;

-- Step 4: Verify RLS is enabled
ALTER TABLE network_interactions ENABLE ROW LEVEL SECURITY;

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ Network interactions RLS policies updated successfully';
  RAISE NOTICE 'Users can now: INSERT their own interactions, SELECT their own interactions';
  RAISE NOTICE 'Admins can: SELECT all interactions';
END $$;
