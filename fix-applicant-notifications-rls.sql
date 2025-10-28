-- ============================================================================
-- FIX APPLICANT_NOTIFICATIONS RLS POLICY
-- This fixes the RLS error when admins try to create notifications
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Drop ALL existing INSERT policies
DROP POLICY IF EXISTS "Opportunity owners can insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Allow insert applicant notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "Admins and owners can insert notifications" ON applicant_notifications;
DROP POLICY IF EXISTS "System can insert applicant notifications" ON applicant_notifications;

-- Create a simple policy that allows admins to insert notifications
-- Note: We check if the current user is an admin
CREATE POLICY "Admins can insert notifications" ON applicant_notifications
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
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
