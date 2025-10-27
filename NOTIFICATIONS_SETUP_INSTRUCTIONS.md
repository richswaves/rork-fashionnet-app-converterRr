# Notifications Setup Instructions

Your app already has the notifications screen and follow functionality fully implemented! You just need to run the updated SQL file in your Supabase database.

## What's Already Working

1. ✅ **Follow/Unfollow Button** - On user profiles (lines 537-557 in `app/profile/[userId].tsx`)
2. ✅ **Notifications Screen** - Shows follows and applications (in `app/notifications.tsx`)
3. ✅ **Follow Counts** - Displays follower and following counts on profiles

## What You Need To Do

### Run the SQL in Supabase

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Open the `supabase-rls-policies.sql` file from this project
4. Copy and paste the **entire file** into the SQL Editor
5. Click "Run" to execute the SQL

This will create three new tables:
- `follows` - Stores follower/following relationships
- `opportunities` - Stores job/opportunity listings (if not already exists)
- `applications` - Stores applications to opportunities

## Testing the Features

### Test Following:
1. Log in as User A
2. Visit another user's profile (User B)
3. Click the "Follow" button
4. The button should change to "Following"
5. Log in as User B
6. Open notifications (bell icon)
7. Click the "Follows" tab
8. You should see "User A started following you"

### Test Applications:
1. Log in as User A
2. Create an opportunity (if you have that feature)
3. Log in as User B
4. Apply to User A's opportunity
5. Log in as User A
6. Open notifications
7. Click the "Applications" tab
8. You should see "User B applied to [opportunity title]"

## Troubleshooting

### If you see "No notifications yet":
- Make sure you've run the SQL in Supabase
- Try following someone or applying to an opportunity
- Check the browser console for any errors
- Verify your Supabase connection in the app

### If the Follow button doesn't work:
- Check browser console for errors
- Verify your Supabase credentials are set correctly
- Make sure you're logged in

## Database Tables Created

### `follows` table:
```
- id (uuid, primary key)
- follower_id (uuid, references auth.users)
- following_id (uuid, references auth.users)
- created_at (timestamptz)
```

### `applications` table:
```
- id (uuid, primary key)
- opportunity_id (uuid, references opportunities)
- applicant_id (uuid, references auth.users)
- message (text, optional)
- status (text: pending, accepted, rejected, withdrawn)
- created_at (timestamptz)
```

### `opportunities` table:
```
- id (uuid, primary key)
- user_id (uuid, references auth.users)
- title (text)
- description (text, optional)
- category (text, optional)
- location (text, optional)
- compensation (text, optional)
- requirements (text, optional)
- status (text: active, closed, draft)
- created_at (timestamptz)
```

## Summary

Everything is already coded and ready to go! Just run the SQL file in Supabase and you'll be able to:
- Follow and unfollow users
- See who follows you in notifications
- See who applies to your opportunities
- View follower/following counts on profiles
