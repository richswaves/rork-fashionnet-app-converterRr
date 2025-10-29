-- ============================================================================
-- FIX APPLICANT_NOTIFICATIONS RLS POLICY - COMPLETE FIX
-- This fixes the 42501 error when admins try to insert profile approval/rejection notifications
-- ============================================================================

-- Drop ALL existing INSERT policies to ensure a clean slate
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

-- Create a comprehensive INSERT policy
-- This policy allows:
-- 1. Admins to insert ANY notification (for profile approvals/rejections)
-- 2. Opportunity owners to insert notifications when related_id references an application they own
CREATE POLICY "Allow admins and opportunity owners to insert notifications" 
ON applicant_notifications
FOR INSERT 
WITH CHECK (
  -- Case 1: User is an admin - can insert any notification
  -- This handles profile approvals/rejections where related_id might be NULL
  EXISTS (
    SELECT 1 
    FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Case 2: User is an opportunity owner inserting an application notification
  -- related_id must reference an application for an opportunity owned by the current user
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

-- Verify the policy was created successfully
SELECT 
  schemaname,
  tablename,
  policyname, 
  permissive, 
  cmd,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK exists'
    ELSE 'NO WITH CHECK'
  END as has_with_check
FROM pg_policies 
WHERE tablename = 'applicant_notifications' 
AND cmd = 'INSERT'
ORDER BY policyname;

-- Display success message
DO $$
BEGIN
  RAISE NOTICE 'RLS policy successfully created for applicant_notifications INSERT';
  RAISE NOTICE 'Admins can now insert profile approval/rejection notifications';
  RAISE NOTICE 'Opportunity owners can insert application status notifications';
END $$;
