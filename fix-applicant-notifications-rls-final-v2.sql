-- ============================================================================
-- FIX APPLICANT_NOTIFICATIONS RLS POLICY - FINAL FIX V2
-- This completely fixes the RLS error when admins try to create notifications
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

-- Create a single, comprehensive INSERT policy
-- This policy allows:
-- 1. Admins to insert ANY notifications (for profile approvals/rejections)
-- 2. Opportunity owners to insert notifications for their applications
CREATE POLICY "Allow admins and opportunity owners to insert notifications" 
ON applicant_notifications
FOR INSERT 
WITH CHECK (
  -- Check if the user is an admin
  EXISTS (
    SELECT 1 
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
  OR
  -- Check if the user owns the opportunity (for application-related notifications)
  -- Only applies when related_id is provided
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
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'applicant_notifications' 
AND cmd = 'INSERT';

-- Also verify that user_roles table exists and has admin users
SELECT COUNT(*) as admin_count FROM user_roles WHERE role = 'admin';
