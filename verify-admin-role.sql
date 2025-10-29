-- ============================================================================
-- VERIFY ADMIN ROLE - Diagnostic Queries
-- Run these to check if the admin user has the correct role
-- ============================================================================

-- 1. Check if user_roles table exists and has data
SELECT * FROM user_roles;

-- 2. Check current authenticated user
SELECT auth.uid() as current_user_id;

-- 3. Check if current user is admin
SELECT EXISTS (
  SELECT 1 
  FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'
) as is_admin;

-- 4. If you know your user ID, replace 'YOUR_USER_ID_HERE' and run this:
-- INSERT INTO user_roles (user_id, role) 
-- VALUES ('YOUR_USER_ID_HERE', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;

-- 5. Check all policies on applicant_notifications
SELECT 
  policyname, 
  permissive, 
  roles, 
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'applicant_notifications';
