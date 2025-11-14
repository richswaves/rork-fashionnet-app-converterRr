# Fix Roles Needed Column Error - Instructions

## Problem
The app is trying to insert `roles_needed` as an array into the opportunities table, but the database schema doesn't have this column. This causes the error:
```
Could not find the 'roles_needed' column of 'opportunities' in the schema cache
```

## Solution
You need to run a SQL migration that adds the missing columns to the opportunities table.

## Steps to Fix

### 1. Run the SQL Migration
The file `add-roles-needed-column.sql` has been created in your project root. You need to run this SQL in your Supabase SQL Editor:

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `add-roles-needed-column.sql`
4. Paste it into the SQL Editor
5. Click "Run" to execute the migration

### 2. What the Migration Does
The migration adds the following columns to the `opportunities` table:
- `roles_needed` (text array) - Stores multiple selected roles
- `type` (text) - Stores comma-separated roles for backward compatibility  
- `budget` (text) - Stores payment information
- `company` (text) - Stores company/user name
- `image_url` (text) - Stores opportunity image

It also:
- Creates indexes for better search performance
- Converts the `requirements` column to text array if needed
- Adds helpful comments explaining the columns
- Grants necessary permissions

### 3. Verify the Fix
After running the migration:
1. Try creating an opportunity with multiple roles selected
2. The error should no longer appear
3. The opportunity should be created successfully

## Current Implementation Status

✅ **Profile Editing**: 
- Primary role is locked and cannot be edited
- Secondary role can be selected/changed
- Both roles are saved to the `professions` array

✅ **Network Page Filtering**:
- Filters members by both primary and secondary roles
- Uses the `professions` array for matching

✅ **Opportunities Page Filtering**:
- Searches by both primary and secondary roles of the poster
- Uses the `professions` array for matching

✅ **Search Analytics**:
- Network page tracks all search interactions
- Opportunity page tracks all search interactions
- Shows result count while typing
- Sends analytics data when search button is clicked

## Next Steps
Once you run the SQL migration, test creating opportunities with multiple roles to ensure everything works correctly.
