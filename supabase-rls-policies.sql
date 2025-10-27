-- ============================================================================
-- RLS POLICIES AND TABLES
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- ===============================
-- PROFILES + USER_ROLES BASICS
-- ===============================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT
USING (true);

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any profile"
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role::text
  );
$$;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON user_roles;

CREATE POLICY "Users can view own roles" ON user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON user_roles
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- ===============================
-- AUTO PROFILE TRIGGER
-- ===============================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, username, account_status, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      'user_' || substr(NEW.id::text, 1, 8)
    ),
    'pending',
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO anon, authenticated;
GRANT SELECT ON user_roles TO authenticated;

-- ===============================
-- SUSPENDED_AT SUPPORT
-- ===============================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

UPDATE profiles 
SET suspended_at = CURRENT_TIMESTAMP 
WHERE account_status = 'suspended' AND suspended_at IS NULL;

CREATE OR REPLACE FUNCTION update_suspended_at()
RETURNS TRIGGER AS $
BEGIN
  IF NEW.account_status = 'suspended' AND OLD.account_status != 'suspended' THEN
    NEW.suspended_at = CURRENT_TIMESTAMP;
  ELSIF NEW.account_status != 'suspended' THEN
    NEW.suspended_at = NULL;
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_suspended_at ON profiles;
CREATE TRIGGER set_suspended_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_suspended_at();

-- ===============================
-- BLOCKED USERS TABLE (ORDER SAFE)
-- ===============================
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own blocks" ON blocked_users;
DROP POLICY IF EXISTS "Users can create blocks" ON blocked_users;
DROP POLICY IF EXISTS "Users can delete blocks" ON blocked_users;
DROP POLICY IF EXISTS "Admins can view all blocks" ON blocked_users;

CREATE POLICY "Users can view own blocks" ON blocked_users
FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create blocks" ON blocked_users
FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete blocks" ON blocked_users
FOR DELETE USING (auth.uid() = blocker_id);

CREATE POLICY "Admins can view all blocks" ON blocked_users
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

GRANT SELECT, INSERT, DELETE ON blocked_users TO authenticated;

-- ===============================
-- REPORTS (ORDER SAFE)
-- ===============================
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reports" ON reports;
DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON reports;
DROP POLICY IF EXISTS "Admins can update reports" ON reports;

CREATE POLICY "Users can view own reports" ON reports
FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Users can create reports" ON reports
FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports" ON reports
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can update reports" ON reports
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

GRANT SELECT, INSERT, UPDATE ON reports TO authenticated;

-- ===============================
-- APPEALS (ORDER SAFE)
-- ===============================
CREATE TABLE IF NOT EXISTS public.appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, created_at)
);

CREATE INDEX IF NOT EXISTS idx_appeals_user ON appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);

ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own appeals" ON appeals;
DROP POLICY IF EXISTS "Users can create appeals" ON appeals;
DROP POLICY IF EXISTS "Admins can view all appeals" ON appeals;
DROP POLICY IF EXISTS "Admins can update appeals" ON appeals;

CREATE POLICY "Users can view own appeals" ON appeals
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create appeals" ON appeals
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.account_status = 'suspended'
  )
);

CREATE POLICY "Admins can view all appeals" ON appeals
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can update appeals" ON appeals
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

GRANT SELECT, INSERT ON appeals TO authenticated;
GRANT UPDATE ON appeals TO authenticated;

-- ===============================
-- USER RATINGS (ORDER SAFE)
-- ===============================
CREATE TABLE IF NOT EXISTS public.user_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rated_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  explanation text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(rater_id, rated_user_id),
  CHECK (rater_id != rated_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_ratings_rater ON user_ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_rated ON user_ratings(rated_user_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_rating ON user_ratings(rating);

ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view ratings for any user" ON user_ratings;
DROP POLICY IF EXISTS "Users can insert ratings" ON user_ratings;
DROP POLICY IF EXISTS "Users can update own ratings" ON user_ratings;

CREATE POLICY "Users can view ratings for any user" ON user_ratings
FOR SELECT USING (true);

CREATE POLICY "Users can insert ratings" ON user_ratings
FOR INSERT WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "Users can update own ratings" ON user_ratings
FOR UPDATE USING (auth.uid() = rater_id);

CREATE OR REPLACE FUNCTION update_user_ratings_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_ratings_updated_at ON user_ratings;
CREATE TRIGGER user_ratings_updated_at
  BEFORE UPDATE ON user_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ratings_updated_at();

GRANT SELECT, INSERT, UPDATE ON user_ratings TO authenticated;
