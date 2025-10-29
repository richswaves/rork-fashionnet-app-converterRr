-- ============================================================================
-- FIX APPLICANT_NOTIFICATIONS RLS POLICY - COMPLETE FINAL FIX
-- This fixes the RLS error when admins try to create notifications for profile approvals/rejections
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Drop ALL existing INSERT policies for applicant_notifications
DROP POLICY IF EXISTS "Opportunity owners can insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Allow insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Admins and owners can insert notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "System can insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Allow admins and opportunity owners to insert notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users based on role" ON applicant_notifications;

-- Create a simplified INSERT policy that:
-- 1. Allows admins to insert ANY notifications (for profile approvals/rejections where related_id is NULL)
-- 2. Allows opportunity owners to insert notifications for their applications (where related_id is NOT NULL)
CREATE POLICY "Allow admins and opportunity owners to insert notifications" 
ON applicant_notifications
FOR INSERT 
WITH CHECK (
  -- Admins can insert any notification
  EXISTS (
    SELECT 1 
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
  OR
  -- Opportunity owners can insert notifications for applications they own
  -- This only applies when related_id is provided (application-related notifications)
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

-- Verify the policy was created successfully
SELECT 
  schemaname,
  tablename,
  policyname, 
  permissive, 
  roles, 
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'applicant_notifications' 
AND cmd = 'INSERT';

-- Verify that user_roles table exists and has admin users
SELECT user_id, role, created_at 
FROM user_roles 
WHERE role = 'admin';

-- Test query: Check if the current user is an admin (run this after login)
-- SELECT EXISTS (
--   SELECT 1 
--   FROM user_roles
--   WHERE user_roles.user_id = auth.uid()
--   AND user_roles.role = 'admin'
-- ) as is_admin;
