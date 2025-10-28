# Database Schema Fix Summary

## Issues Fixed

### 1. **Column `profiles.email` does not exist**
- **Problem**: The admin approvals page was trying to select an `email` column from the `profiles` table that doesn't exist
- **Solution**: Removed `email` from the select query in `app/admin/approvals.tsx`
- **Note**: Email data is stored in `auth.users` table, not in `profiles`

### 2. **Foreign key relationship error with `blocked_users` table**
- **Problem**: PostgREST couldn't find the foreign key relationship between `blocked_users` and `profiles` when using the hint `blocked_user_id`
- **Solution**: Created a comprehensive SQL script to recreate the `blocked_users` table with proper foreign key references to `auth.users`

## Files Modified

### 1. `app/admin/approvals.tsx`
- Removed `email` field from the `AdminUser` interface
- Removed `email` from the database select query
- Fixed unused variable warnings
- Fixed React Query dependency warnings

### 2. `fix-schema-errors.sql` (NEW)
This SQL script needs to be run in your Supabase SQL Editor. It performs the following:

1. **Removes the email column** from profiles table (if it exists)
2. **Recreates the blocked_users table** with correct structure:
   - Foreign keys to `auth.users` instead of `profiles`
   - Proper indexes for performance
   - RLS policies for security
3. **Ensures profiles table** has all necessary columns including `social_links` as JSONB
4. **Creates a helper view** `admin_user_details` that joins profiles with auth.users for admin access to email (if needed)
5. **Recreates all block-related functions**:
   - `is_blocked(uuid)`
   - `block_user(uuid)`
   - `unblock_user(uuid)`

## Next Steps

### Required Action: Run the SQL Script

1. Open your Supabase Dashboard
2. Go to the SQL Editor
3. Copy the contents of `fix-schema-errors.sql`
4. Paste it into the SQL Editor
5. Click "Run" to execute

### Verification

After running the SQL script, verify the fixes by running these queries in your Supabase SQL Editor:

```sql
-- Check profiles table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check blocked_users table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'blocked_users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check foreign keys on blocked_users
SELECT
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name='blocked_users';
```

### Testing

After running the SQL script, test the following in your app:

1. ✅ Admin approvals page should load without errors
2. ✅ User applications should be visible
3. ✅ Social links should display correctly
4. ✅ Block/unblock functionality should work
5. ✅ No more "email does not exist" errors
6. ✅ No more "foreign key relationship" errors

## Additional Notes

- The `admin_user_details` view was created as a convenience for future admin features that might need access to user emails
- All RLS (Row Level Security) policies have been properly configured
- The block functions use `SECURITY DEFINER` to ensure they work correctly with RLS
- Existing data in `blocked_users` table will be preserved if you modify the script to not use `DROP TABLE` (use `ALTER TABLE` instead)

## Support

If you encounter any issues:
1. Check the Supabase logs for detailed error messages
2. Ensure you have proper admin permissions in your database
3. Verify that RLS is enabled on all tables
4. Check that your user has the 'admin' role in the `user_roles` table
