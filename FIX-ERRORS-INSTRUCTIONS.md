# Database Error Fix Instructions

## Summary of Errors

Your application has the following database-related errors:

1. **404 Insert Error** - Missing `account_deletion_feedback` table
2. **Account Deletion Failed** - Missing `delete_user_account()` RPC function
3. **Foreign Key Relationship Error** - `blocked_users` table has incorrect foreign key relationships
4. **Activity Tracking Errors** - Missing activity tracking tables (non-critical but recommended)

## Solution

I've created a comprehensive SQL migration file `fix-all-errors.sql` that will fix all these errors.

## Steps to Fix

### Step 1: Run the SQL Migration

1. Go to your Supabase dashboard: https://app.supabase.com
2. Navigate to your project
3. Go to the **SQL Editor** section
4. Click **New Query**
5. Copy the entire contents of `fix-all-errors.sql`
6. Paste it into the SQL editor
7. Click **Run** to execute the migration

### Step 2: Verify the Fix

After running the SQL migration, verify that all tables and functions were created:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'account_deletion_feedback',
  'blocked_users',
  'user_activity_events',
  'search_analytics',
  'opportunity_interactions',
  'network_interactions'
);

-- Check if function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'delete_user_account';
```

You should see all 6 tables and the `delete_user_account` function.

### Step 3: Test the Application

After running the migration:

1. **Test Account Deletion**: Try deleting an account to ensure the feedback logging and deletion work
2. **Test Blocked Users**: Try blocking/unblocking users to ensure the relationship works
3. **Test Activity Tracking**: The activity tracking should now work without errors (check console)

## What the Migration Does

### 1. Creates `account_deletion_feedback` Table
Stores user feedback when they delete their account. Includes:
- User ID
- Deletion reason
- Timestamp
- Proper RLS policies for security

### 2. Creates `delete_user_account()` Function
A PostgreSQL function that:
- Verifies the user is deleting their own account
- Deletes all user data from related tables
- Removes the user from authentication
- Handles cascade deletions properly

### 3. Fixes `blocked_users` Table
Recreates the table with:
- Correct foreign key relationships to `auth.users`
- Proper indexes for performance
- Updated RLS policies
- Updated block/unblock functions

### 4. Creates Activity Tracking Tables
Creates tables for:
- User activity events
- Search analytics
- Opportunity interactions
- Network interactions

All with proper RLS policies and indexes.

## Code Changes Made

I've also updated `app/profile/edit.tsx` to fix the foreign key relationship hint issue:

**Before:**
```typescript
select: "blocked_user_id,user:profiles!blocked_user_id(...)"
```

**After:**
```typescript
select: "blocked_user_id,blocked_user_profile:profiles!blocked_users_blocked_user_id_fkey(...)"
```

This matches the actual foreign key constraint name in the database.

## Troubleshooting

### If you get permission errors:
Make sure you're logged in as a Supabase admin when running the SQL.

### If tables already exist but are corrupted:
The migration includes `DROP TABLE IF EXISTS` statements that will safely recreate the tables with proper structure. Existing data in `blocked_users` will be preserved.

### If you see errors about missing columns:
Run the migration again - it's idempotent and safe to run multiple times.

## After the Fix

All these errors should be resolved:
- ✅ `Supabase insert error 404 {}` 
- ✅ `[Delete] Feedback logging failed (non-critical): {}`
- ✅ `[Delete] Account deletion failed: Could not find the function...`
- ✅ `Supabase select error 400 {..."blocked_users" and "profiles"...}`
- ✅ `[ActivityTracking] Failed to track network interaction: Error: {}`

## Support

If you encounter any issues after running the migration, check:
1. The SQL execution completed without errors
2. All tables were created successfully (use the verification queries above)
3. Your app has been restarted to pick up the changes
