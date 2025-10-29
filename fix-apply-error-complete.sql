-- ============================================================================
-- COMPLETE FIX FOR APPLICATION APPROVAL/REJECTION ERRORS
-- This script fixes the RLS policy errors when approving/rejecting applications
-- Error: "new row violates row-level security policy for table applicant_notifications"
-- ============================================================================

-- PART 1: DIAGNOSTIC - Run this first to see the current state
-- ============================================================================

SELECT '=== PART 1: DIAGNOSTIC ===' as section;

-- Check 1: What's your current user ID?
SELECT 
  auth.uid() as your_user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN '❌ NOT LOGGED IN - You must be logged in'
    ELSE '✅ Logged in'
  END as auth_status;

-- Check 2: Are you an admin?
SELECT 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    THEN '❌ NOT AN ADMIN - This is likely the problem'
    ELSE '✅ You are an admin'
  END as admin_status;

-- Check 3: Show all admin users
SELECT 
  'Current admins in system:' as info,
  user_id,
  role,
  created_at
FROM user_roles 
WHERE role = 'admin'
ORDER BY created_at DESC;

-- Check 4: Show current RLS policies
SELECT 
  'Current RLS policies on applicant_notifications:' as info,
  policyname,
  cmd,
  substring(with_check::text, 1, 100) as policy_check_preview
FROM pg_policies 
WHERE tablename = 'applicant_notifications'
ORDER BY cmd, policyname;

-- ============================================================================
-- PART 2: FIX THE RLS POLICY
-- ============================================================================

SELECT '=== PART 2: FIXING RLS POLICY ===' as section;

-- Step 1: Drop all existing INSERT policies
DO $$ 
BEGIN
  RAISE NOTICE 'Dropping old INSERT policies...';
  
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
  
  RAISE NOTICE 'Old policies dropped successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping policies (this is OK if they dont exist): %', SQLERRM;
END $$;

-- Step 2: Ensure table exists with correct structure
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_applicant_notifications_applicant ON applicant_notifications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applicant_notifications_created_at ON applicant_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applicant_notifications_read ON applicant_notifications(read);

-- Step 3: Enable RLS
ALTER TABLE applicant_notifications ENABLE ROW LEVEL SECURITY;

-- Step 4: Create the new INSERT policy
-- This allows:
-- 1. Admins to insert ANY notification (for profile approvals/rejections)
-- 2. Opportunity owners to insert application notifications (for app approvals/rejections)
CREATE POLICY "Admins and opportunity owners can insert notifications" 
ON applicant_notifications
FOR INSERT 
WITH CHECK (
  -- Admins can insert any notification
  EXISTS (
    SELECT 1 
    FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Opportunity owners can insert application notifications
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

-- Step 5: Ensure other policies exist
DROP POLICY IF EXISTS "Users can view own applicant notifications" ON applicant_notifications;
CREATE POLICY "Users can view own applicant notifications" 
ON applicant_notifications
FOR SELECT 
USING (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Users can update own applicant notifications" ON applicant_notifications;
CREATE POLICY "Users can update own applicant notifications" 
ON applicant_notifications
FOR UPDATE 
USING (auth.uid() = applicant_id)
WITH CHECK (auth.uid() = applicant_id);

-- Step 6: Grant permissions
GRANT SELECT, INSERT, UPDATE ON applicant_notifications TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

SELECT '✅ RLS policies updated successfully' as result;

-- ============================================================================
-- PART 3: GRANT ADMIN ROLE (if needed)
-- ============================================================================

SELECT '=== PART 3: GRANT ADMIN ROLE ===' as section;

-- To grant admin role to the current user, uncomment and run:
/*
INSERT INTO user_roles (user_id, role)
VALUES (auth.uid(), 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

SELECT 'Admin role granted to current user' as result;
*/

-- Or to grant to a specific user ID, uncomment and replace YOUR_USER_ID:
/*
INSERT INTO user_roles (user_id, role)
VALUES ('YOUR_USER_ID', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
*/

-- ============================================================================
-- PART 4: VERIFY THE FIX
-- ============================================================================

SELECT '=== PART 4: VERIFICATION ===' as section;

-- Verify policy was created
SELECT 
  '✅ New policy created' as status,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'applicant_notifications' 
AND cmd = 'INSERT'
ORDER BY policyname;

-- Verify you're an admin now (run after granting role)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    ) THEN '✅ You are an admin - approvals should work now'
    ELSE '❌ You are NOT an admin yet - run PART 3 to grant yourself admin role'
  END as final_status;

-- ============================================================================
-- PART 5: TEST (optional)
-- ============================================================================

SELECT '=== PART 5: TESTING ===' as section;

-- Test inserting a notification (uncomment to test)
/*
INSERT INTO applicant_notifications (applicant_id, type, title, message, related_id)
VALUES (
  auth.uid(),
  'test_admin',
  'Test Admin Notification',
  'Testing notification insert after fix',
  NULL
);

SELECT 'Test notification inserted successfully' as test_result;

-- View the test notification
SELECT * FROM applicant_notifications WHERE type = 'test_admin' ORDER BY created_at DESC LIMIT 1;

-- Clean up test notification
DELETE FROM applicant_notifications WHERE type = 'test_admin';
*/

-- ============================================================================
-- INSTRUCTIONS
-- ============================================================================

/*
HOW TO USE THIS SCRIPT:

1. Run PART 1 (DIAGNOSTIC) first to see current state
   - Check if you're logged in
   - Check if you're an admin
   - See existing policies

2. Run PART 2 (FIX THE RLS POLICY)
   - This updates the policies to allow admins to insert notifications

3. If PART 1 showed you're NOT an admin:
   - Uncomment and run the INSERT in PART 3 to grant yourself admin role
   
4. Run PART 4 (VERIFICATION) to confirm the fix worked

5. (Optional) Run PART 5 (TEST) to test inserting a notification

COMMON ISSUES:

Q: Still getting "new row violates row-level security policy"?
A: You're probably not logged in as an admin. Run:
   SELECT * FROM user_roles WHERE user_id = auth.uid();
   If no rows returned, you need to grant yourself admin role (PART 3)

Q: How do I know my user ID?
A: Run: SELECT auth.uid();
   Or look in your profiles table: SELECT user_id FROM profiles WHERE username = 'your_username';

Q: The policy exists but still failing?
A: Make sure you're using the correct user account. The policy checks if
   auth.uid() has an entry in user_roles with role='admin'
*/

SELECT '=== SCRIPT COMPLETE ===' as section;
SELECT 'Review the output above and follow the instructions' as next_steps;
