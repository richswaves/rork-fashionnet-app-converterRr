# Supabase Database Fix Instructions

## Overview
Several database tables and functions are missing from your Supabase database, causing the errors you're experiencing. Follow these steps to fix them.

## Steps to Fix

### 1. Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor tab
3. Create a new query

### 2. Run the Updated SQL Script
Copy and paste the entire contents of `supabase-rls-policies.sql` into the SQL Editor and run it.

The script will:
- ✅ Create the `account_deletion_feedback` table (fixes the insert error)
- ✅ Create the `delete_user_account()` RPC function (fixes the account deletion error)
- ✅ Fix all RLS policies for existing tables
- ✅ Set up proper indexes for performance

### 3. Verify the Changes
After running the script, verify that the following exist:

**Tables:**
- `profiles`
- `user_roles`
- `blocked_users`
- `reports`
- `appeals`
- `account_deletion_feedback` ← NEW

**Functions:**
- `has_role(uuid, text)`
- `handle_new_user()`
- `is_blocked(uuid)`
- `block_user(uuid)`
- `unblock_user(uuid)`
- `delete_user_account(uuid)` ← NEW

## What Was Fixed

### Error 1: Missing foreign key relationship
**Error:** `Could not find a relationship between 'blocked_users' and 'profiles'`
**Fix:** Updated the backend block route to not attempt to join these tables via hint

### Error 2: Insert error 404
**Error:** `Supabase insert error 404 {}`
**Fix:** Created the missing `account_deletion_feedback` table with proper RLS policies

### Error 3: Feedback logging failed
**Error:** `[Delete] Feedback logging failed (non-critical): {}`
**Fix:** Same as Error 2 - the table now exists

### Error 4: Account deletion failed
**Error:** `Could not find the function public.delete_user_account(target_user_id)`
**Fix:** Created the `delete_user_account()` RPC function that:
- Validates the user can only delete their own account
- Removes all user data from all tables
- Handles tables that may or may not exist
- Finally deletes the auth user

## Important Notes

1. **Run the entire SQL script** - Don't run it in pieces, as some parts depend on others
2. **The script is idempotent** - It's safe to run multiple times (uses `CREATE IF NOT EXISTS` and `DROP POLICY IF EXISTS`)
3. **Existing data is preserved** - The script only creates missing structures
4. **Test after running** - Try the features that were failing to ensure they work now

## Testing Checklist

After running the SQL script, test these features:

- [ ] Report a user
- [ ] Block/unblock a user
- [ ] View list of blocked users
- [ ] Delete account (creates feedback entry and removes account)

## Need Help?

If you encounter any errors while running the SQL script:
1. Copy the exact error message
2. Check which line number failed
3. Verify your Supabase project has the required permissions
