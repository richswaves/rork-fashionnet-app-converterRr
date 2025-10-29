-- ============================================================================
-- FIX APPLICANT_NOTIFICATIONS RLS POLICY - FINAL SOLUTION
-- This fixes the RLS error when admins insert notifications
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Step 1: Drop ALL existing INSERT policies for applicant_notifications
DROP POLICY IF EXISTS "Opportunity owners can insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Allow insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Admins and owners can insert notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "System can insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Allow admins and opportunity owners to insert notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users based on role" ON applicant_notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON applicant_notifications;

-- Step 2: Create a new, simplified INSERT policy
-- This policy allows authenticated users to insert notifications with proper checks
CREATE POLICY "Authenticated users can insert notifications" 
ON applicant_notifications
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Always allow if user is an admin
  (
    EXISTS (
      SELECT 1 
      FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  OR
  -- Allow if user is an opportunity owner inserting an application notification
  (
    related_id IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM applications a
      INNER JOIN opportunities o ON o.id = a.opportunity_id
      WHERE a.id = related_id
      AND o.user_id = auth.uid()
      AND a.applicant_id = applicant_notifications.applicant_id
    )
  )
);

-- Step 3: Ensure permissions are granted
GRANT INSERT ON applicant_notifications TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 4: Verify the policy was created successfully
SELECT 
  schemaname,
  tablename,
  policyname, 
  permissive, 
  roles::text[], 
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'applicant_notifications' 
AND cmd = 'INSERT'
ORDER BY policyname;

-- Step 5: Check that admin users exist
SELECT 
  user_id, 
  role, 
  created_at 
FROM user_roles 
WHERE role = 'admin'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- VERIFICATION QUERY
-- Run this as an admin user to verify you can insert notifications
-- ============================================================================

-- Check if current user is an admin
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    ) THEN 'YES - You are an admin'
    ELSE 'NO - You are not an admin'
  END as admin_status,
  auth.uid() as your_user_id;
