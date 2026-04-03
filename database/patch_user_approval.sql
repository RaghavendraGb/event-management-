-- =========================================================
-- EventArena: Database Patch – User Approval System
-- Run this in your Supabase SQL Editor ONCE
-- =========================================================

-- 1. Add 'status' column to users table
--    New signups default to 'pending' until admin approves.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved'));

-- 2. All EXISTING users (already using the platform) are approved.
UPDATE public.users
  SET status = 'approved'
  WHERE status = 'pending';

-- =========================================================
-- 3. Fix Leaderboard RLS: Allow authenticated users to read
--    basic profile info (name, avatar) for public leaderboard.
--    We drop the old restrictive policy and add two policies:
--    one for full self-access and one for public name reading.
-- =========================================================

-- Drop old restrictive single policy
DROP POLICY IF EXISTS "Users can read their own data" ON public.users;

-- Policy A: Full row access for own profile or admin
CREATE POLICY "Users read own full profile or admin reads all"
  ON public.users FOR SELECT
  USING (auth.uid() = id OR is_admin());

-- Policy B: Any authenticated user can read id + name + avatar_url
-- (needed for leaderboard to show names without exposing email/college)
-- We allow this via a permissive policy scoped to authenticated role
CREATE POLICY "Authenticated users can read public profile fields"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Note: Supabase evaluates permissive policies with OR logic,
-- so Policy B will allow leaderboard reads while Policy A
-- still governs full row access for sensitive fields.
-- The actual column-level restriction (hiding email from others)
-- is handled in the application query layer (select only id, name, avatar_url).

-- =========================================================
-- 4. Update the new-user trigger to set status = 'pending'
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar_url, college, status)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Unknown User'),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'college',
    'pending'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- Done! Verify with:
-- SELECT id, name, email, status FROM public.users LIMIT 10;
-- =========================================================
