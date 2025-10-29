-- ============================================================================
-- FINAL FIX FOR APPLICANT_NOTIFICATIONS RLS POLICY
-- This addresses the RLS error when approving/rejecting applications
-- ============================================================================

-- Step 1: Drop ALL existing INSERT policies for applicant_notifications
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Opportunity owners can insert applicant notifications" ON applicant_notifications;
  DROP POLICY IF EXISTS "Allow insert applicant notifications" ON applicant_notifications;
  DROP POLICY IF EXISTS "Admins and owners can insert notifications" ON applicant_notifications;
  DROP POLICY IF EXISTS "System can insert applicant notifications" ON applicant_notifications;
  DROP POLICY IF EXISTS "Admins can insert notifications" ON applicant_notifications;
  DROP POLICY IF EXISTS "Allow admins and opportunity owners to insert notifications" ON applicant_notifications;
  DROP POLICY IF EXISTS "Enable insert for authenticated users based on role" ON applicant_notifications;
  DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON applicant_notifications;
  DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON applicant_notifications;
  DROP POLICY IF EXISTS "Allow admins and opportunity owners to insert" ON applicant_notifications;
  DROP POLICY IF EXISTS "Admins and opportunity owners can insert notifications" ON applicant_notifications;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Table applicant_notifications does not exist yet';
END $$;

-- Step 2: Create a comprehensive INSERT policy that allows:
-- 1. Admins to insert any notification
-- 2. Opportunity owners to insert notifications for their opportunity applicants
CREATE POLICY "Allow admins and opportunity owners to insert notifications"
ON applicant_notifications
FOR INSERT
WITH CHECK (
  -- Allow admins to insert any notification
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
  OR
  -- Allow opportunity owners to insert notifications for applicants
  (
    related_id IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM applications a
      JOIN opportunities o ON o.id = a.opportunity_id
      WHERE a.id = related_id
      AND o.user_id = auth.uid()
      AND a.applicant_id = applicant_notifications.applicant_id
    )
  )
);

-- Step 3: Ensure permissions are granted
GRANT INSERT ON applicant_notifications TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show all RLS policies for applicant_notifications
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'applicant_notifications' 
ORDER BY cmd, policyname;

RAISE NOTICE 'RLS policy successfully created for applicant_notifications INSERT';
RAISE NOTICE 'Admins and opportunity owners can now insert notifications';
