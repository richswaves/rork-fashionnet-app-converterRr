-- ============================================================================
-- COMPLETE FIX FOR APPLICANT_NOTIFICATIONS RLS POLICY
-- This fixes the 42501 RLS error when admins insert notifications
-- Run this entire script in your Supabase SQL Editor
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
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Table applicant_notifications does not exist yet';
END $$;

-- Step 2: Ensure the applicant_notifications table exists
CREATE TABLE IF NOT EXISTS public.applicant_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  related_id uuid,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_applicant_notifications_applicant ON applicant_notifications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applicant_notifications_created_at ON applicant_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applicant_notifications_read ON applicant_notifications(read);

-- Step 3: Enable RLS
ALTER TABLE applicant_notifications ENABLE ROW LEVEL SECURITY;

-- Step 4: Create a simplified INSERT policy that allows admins to insert ANY notification
-- This policy checks if the user is an admin first, then falls back to opportunity owner check
CREATE POLICY "Allow authenticated users to insert notifications" 
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

-- Step 5: Create SELECT policy (users can view their own notifications)
DROP POLICY IF EXISTS "Users can view own applicant notifications" ON applicant_notifications;
CREATE POLICY "Users can view own applicant notifications" 
ON applicant_notifications
FOR SELECT 
USING (auth.uid() = applicant_id);

-- Step 6: Create UPDATE policy (users can update their own notifications to mark as read)
DROP POLICY IF EXISTS "Users can update own applicant notifications" ON applicant_notifications;
CREATE POLICY "Users can update own applicant notifications" 
ON applicant_notifications
FOR UPDATE 
USING (auth.uid() = applicant_id)
WITH CHECK (auth.uid() = applicant_id);

-- Step 7: Grant permissions
GRANT SELECT, INSERT, UPDATE ON applicant_notifications TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check 1: Verify the policy was created
SELECT 
  policyname, 
  permissive, 
  roles::text[], 
  cmd,
  with_check::text
FROM pg_policies 
WHERE tablename = 'applicant_notifications' 
ORDER BY cmd, policyname;

-- Check 2: Verify admin users exist
SELECT 
  user_id, 
  role, 
  created_at 
FROM user_roles 
WHERE role = 'admin'
ORDER BY created_at DESC
LIMIT 5;

-- Check 3: Check if current user is an admin
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

-- ============================================================================
-- GRANT ADMIN ROLE (if you need to make yourself an admin)
-- Replace 'YOUR-USER-ID-HERE' with your actual user ID
-- ============================================================================

-- Uncomment and run this if you need to grant yourself admin role:
-- INSERT INTO user_roles (user_id, role)
-- VALUES ('YOUR-USER-ID-HERE', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;

-- To find your user ID, run this query while logged in:
-- SELECT auth.uid();

-- ============================================================================
-- TEST QUERY (uncomment to test notification insertion)
-- ============================================================================

-- Test inserting a notification (replace with a valid user_id from your database)
-- INSERT INTO applicant_notifications (applicant_id, type, title, message, related_id)
-- VALUES (
--   (SELECT user_id FROM profiles LIMIT 1),
--   'test',
--   'Test Notification',
--   'Testing notification insert',
--   NULL
-- );
