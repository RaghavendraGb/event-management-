-- ══════════════════════════════════════════════════════════
-- EventX Platform — DB Patch + Admin Setup
-- ══════════════════════════════════════════════════════════
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard/project/jfqynyxhzusyiwavuijg/sql/new
--   2. Paste this ENTIRE file and click "Run"
-- ══════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────
-- PATCH 1: Add 'completed' status to participation enum
-- (App code uses 'completed' but old schema only had 'submitted')
-- ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'completed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'participation_status')
  ) THEN
    ALTER TYPE participation_status ADD VALUE 'completed';
  END IF;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- PATCH 2: Fix answers column default (array [] → object {})
-- ──────────────────────────────────────────────────────────
ALTER TABLE participation
  ALTER COLUMN answers SET DEFAULT '{}'::jsonb;

UPDATE participation
  SET answers = '{}'::jsonb
  WHERE jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) = 0;


-- ──────────────────────────────────────────────────────────
-- PATCH 3: Update auth trigger — auto-elevate admin emails
-- ALL other new signups continue to get 'user' role
-- ──────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role user_role;
BEGIN
  -- These two emails always get admin role
  IF new.email IN ('usiddik331@gmail.com', 'raghavendragb2@gmail.com') THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'user';
  END IF;

  INSERT INTO public.users (id, name, email, avatar_url, college, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'college',
    assigned_role
  )
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ──────────────────────────────────────────────────────────
-- PATCH 4: Immediately set admin role for existing accounts
-- (safe — only updates if they already exist)
-- ──────────────────────────────────────────────────────────
UPDATE public.users
  SET role = 'admin'
  WHERE email IN ('usiddik331@gmail.com', 'raghavendragb2@gmail.com');


-- ──────────────────────────────────────────────────────────
-- PATCH 5: Fix Certificate RLS
-- Users must INSERT their own certificates (was admin-only)
-- ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Certificates writable by admins" ON certificates;
DROP POLICY IF EXISTS "Users can read own certificates" ON certificates;
DROP POLICY IF EXISTS "Users can insert own certificate" ON certificates;
DROP POLICY IF EXISTS "Users can update own certificate" ON certificates;
DROP POLICY IF EXISTS "Admins full certificate access" ON certificates;
DROP POLICY IF EXISTS "Admins can manage all certificates" ON certificates;

CREATE POLICY "Users can read own certificates"
  ON certificates FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can insert own certificate"
  ON certificates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own certificate"
  ON certificates FOR UPDATE
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins full certificate access"
  ON certificates FOR DELETE
  USING (is_admin());


-- ──────────────────────────────────────────────────────────
-- PATCH 6: Fix Users table RLS
-- Lobby/Leaderboard need to read participant names publicly
-- ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Users are publicly readable (name/avatar only)" ON users;
DROP POLICY IF EXISTS "Users publicly readable" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

CREATE POLICY "Users publicly readable"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id OR is_admin());


-- ──────────────────────────────────────────────────────────
-- VERIFY — Check results
-- ──────────────────────────────────────────────────────────
DO $$
DECLARE
  admin_count  INTEGER;
  enum_has_completed BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.users WHERE role = 'admin';

  SELECT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'completed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'participation_status')
  ) INTO enum_has_completed;

  RAISE NOTICE '══════════════════════════════════';
  RAISE NOTICE 'Patch Results:';
  RAISE NOTICE '  Admin users in DB : %', admin_count;
  RAISE NOTICE '  Enum has completed: %', enum_has_completed;
  RAISE NOTICE '══════════════════════════════════';
END;
$$;
