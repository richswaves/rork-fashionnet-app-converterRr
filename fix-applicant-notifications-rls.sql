-- ============================================================================
-- FIX APPLICANT_NOTIFICATIONS RLS POLICY
-- This fixes the RLS error when admins try to create notifications
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Drop the existing policy
DROP POLICY IF EXISTS "Opportunity owners can insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Allow insert applicant notifications" ON applicant_notifications;

-- Create a simplified policy that allows admins to insert notifications
-- and opportunity owners to insert notifications for their applications
CREATE POLICY "Admins and owners can insert notifications" ON applicant_notifications
FOR INSERT TO authenticated
WITH CHECK (
  -- Check if user is an admin
  (
    SELECT COUNT(*) > 0
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
  OR
  -- Check if user is the opportunity owner (for application notifications)
  (
    related_id IS NOT NULL
    AND (
      SELECT COUNT(*) > 0
      FROM applications a
      INNER JOIN opportunities o ON o.id = a.opportunity_id
      WHERE a.id = related_id
      AND o.user_id = auth.uid()
      AND a.applicant_id = applicant_notifications.applicant_id
    )
  )
);

-- Ensure permissions are granted
GRANT INSERT ON applicant_notifications TO authenticated;

-- Verify the policy was created
SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'applicant_notifications' 
AND policyname = 'Admins and owners can insert notifications';
