-- Fix blocked_users table to have proper relationship with profiles table
-- This allows PostgREST to resolve the foreign key hint

-- First, ensure the profiles table has the proper primary key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'profiles' 
    AND constraint_type = 'PRIMARY KEY'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles ADD PRIMARY KEY (user_id);
  END IF;
END
$$;

-- Drop the existing blocked_users table and recreate with proper foreign keys
DROP TABLE IF EXISTS public.blocked_users CASCADE;

CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_user_id),
  CHECK (blocker_id != blocked_user_id),
  -- Add foreign keys that reference profiles table directly
  CONSTRAINT blocked_users_blocker_id_fkey FOREIGN KEY (blocker_id) 
    REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  CONSTRAINT blocked_users_blocked_user_id_fkey FOREIGN KEY (blocked_user_id) 
    REFERENCES public.profiles(user_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX idx_blocked_users_blocked_user ON public.blocked_users(blocked_user_id);

-- Enable Row Level Security
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view own blocks" ON public.blocked_users;
CREATE POLICY "Users can view own blocks" ON public.blocked_users
FOR SELECT USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can create blocks" ON public.blocked_users;
CREATE POLICY "Users can create blocks" ON public.blocked_users
FOR INSERT WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can delete blocks" ON public.blocked_users;
CREATE POLICY "Users can delete blocks" ON public.blocked_users
FOR DELETE USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Admins can view all blocks" ON public.blocked_users;
CREATE POLICY "Admins can view all blocks" ON public.blocked_users
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.blocked_users TO anon;

-- Update or create the block/unblock functions
DROP FUNCTION IF EXISTS public.block_user(uuid);
CREATE OR REPLACE FUNCTION public.block_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.blocked_users (blocker_id, blocked_user_id)
  VALUES (auth.uid(), target_user_id)
  ON CONFLICT (blocker_id, blocked_user_id) DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS public.unblock_user(uuid);
CREATE OR REPLACE FUNCTION public.unblock_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.blocked_users
  WHERE blocker_id = auth.uid()
  AND blocked_user_id = target_user_id;
END;
$$;

DROP FUNCTION IF EXISTS public.is_blocked(uuid);
CREATE OR REPLACE FUNCTION public.is_blocked(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = auth.uid()
    AND blocked_user_id = target_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = target_user_id
    AND blocked_user_id = auth.uid()
  );
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
