-- ============================================================================
-- ADD SOCIAL_LINKS COLUMN TO PROFILES
-- ============================================================================
-- This adds the social_links JSONB column to the profiles table

-- Add social_links as JSONB if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public' 
  AND column_name = 'social_links';

-- ============================================================================
-- DONE
-- ============================================================================
