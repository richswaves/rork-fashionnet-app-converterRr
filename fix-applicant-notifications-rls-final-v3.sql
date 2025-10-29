-- ============================================================================
-- FIX APPLICANT_NOTIFICATIONS RLS POLICY - FINAL V3
-- This completely fixes the RLS error when admins create notifications
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
-- This policy allows:
-- 1. Admins to insert ANY notification (profile approvals, rejections, etc.)
-- 2. Opportunity owners to insert notifications related to their applications
CREATE POLICY "Authenticated users can insert notifications" 
ON applicant_notifications
FOR INSERT 
WITH CHECK (
  -- Check 1: User is an admin (can insert any notification)
  EXISTS (
    SELECT 1 
    FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Check 2: User is an opportunity owner inserting an application notification
  -- (related_id must reference an application they own)
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

-- Step 4: Verification queries
-- Check that the policy was created
SELECT 
  policyname, 
  permissive, 
  roles, 
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'applicant_notifications' 
AND cmd = 'INSERT';

-- Check admin users exist
SELECT user_id, role, created_at 
FROM user_roles 
WHERE role = 'admin'
LIMIT 5;

-- ============================================================================
-- TEST QUERIES (uncomment to test after running the fix)
-- ============================================================================

-- Test 1: Check if current user is an admin
-- SELECT EXISTS (
--   SELECT 1 
--   FROM user_roles
--   WHERE user_id = auth.uid()
--   AND role = 'admin'
-- ) as is_admin;

-- Test 2: Try inserting a test notification (run as admin)
-- INSERT INTO applicant_notifications (applicant_id, type, title, message, related_id)
-- VALUES (
--   auth.uid(),  -- Replace with actual applicant_id
--   'test',
--   'Test Notification',
--   'Testing notification insert',
--   NULL
-- );

-- Test 3: View all notifications
-- SELECT * FROM applicant_notifications ORDER BY created_at DESC LIMIT 10;
