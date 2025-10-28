-- ============================================================================
-- FIX APPLICANT_NOTIFICATIONS RLS POLICY
-- This fixes the RLS error when admins try to create notifications
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Drop ALL existing INSERT policies for applicant_notifications
DROP POLICY IF EXISTS "Opportunity owners can insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Allow insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Admins and owners can insert notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "System can insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON applicant_notifications;

-- Create a comprehensive INSERT policy that allows:
-- 1. Admins to insert any notifications (for profile approvals/rejections)
-- 2. Opportunity owners to insert notifications (for application approvals/rejections)
CREATE POLICY "Allow admins and opportunity owners to insert notifications" 
ON applicant_notifications
FOR INSERT 
WITH CHECK (
  -- Admins can insert any notifications
  EXISTS (
    SELECT 1 
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
  OR
  -- Opportunity owners can insert notifications for their opportunity applications
  (
    related_id IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM applications a
      JOIN opportunities o ON o.id = a.opportunity_id
      WHERE a.id = related_id
      AND o.user_id = auth.uid()
      AND a.applicant_id = applicant_id
    )
  )
);

-- Ensure permissions are granted
GRANT INSERT ON applicant_notifications TO authenticated;

-- Verify the policy was created
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
