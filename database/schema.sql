-- ==========================================
-- Supabase Schema for EventX Platform
-- ==========================================

-- Clean up any failed partial runs safely
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS event_questions CASCADE;
DROP TABLE IF EXISTS participation CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS email_log CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS question_bank CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS event_type CASCADE;
DROP TYPE IF EXISTS event_status CASCADE;
DROP TYPE IF EXISTS difficulty_level CASCADE;
DROP TYPE IF EXISTS participation_status CASCADE;
DROP TYPE IF EXISTS cert_type CASCADE;


-- 1. Create Custom Types & Enums
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE event_type AS ENUM ('quiz', 'rapid_fire', 'treasure_hunt');
CREATE TYPE event_status AS ENUM ('upcoming', 'live', 'ended');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE participation_status AS ENUM ('registered', 'active', 'submitted', 'completed');
CREATE TYPE user_status AS ENUM ('pending', 'approved', 'blocked');
CREATE TYPE cert_type AS ENUM ('participation', 'winner');

-- ==========================================
-- 2. Tables Creation
-- ==========================================

-- Users mapping to Supabase Auth
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  role user_role DEFAULT 'user',
  status user_status DEFAULT 'pending',
  college TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type event_type NOT NULL DEFAULT 'quiz',
  status event_status NOT NULL DEFAULT 'upcoming',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  max_participants INTEGER,
  sponsor_logo_url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Question Bank
CREATE TABLE question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  difficulty difficulty_level DEFAULT 'medium',
  tags TEXT[],
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Questions Pipeline
CREATE TABLE event_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  order_num INTEGER NOT NULL,
  time_limit_seconds INTEGER DEFAULT 60,
  UNIQUE(event_id, question_id)
);

-- Participations (Progress & Submissions)
CREATE TABLE participation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  score INTEGER DEFAULT 0,
  answers JSONB DEFAULT '{}'::jsonb,
  violations INTEGER DEFAULT 0,
  status participation_status DEFAULT 'registered',
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  UNIQUE(user_id, event_id)
);

-- Certificates
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type cert_type DEFAULT 'participation',
  rank INTEGER,
  cert_uid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  pdf_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Logs
CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent'
);

-- ==========================================
-- 3. Row Level Security (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check if auth user is admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Users Policy
CREATE POLICY "Users can read their own data" ON users FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "Users can update their own data" ON users FOR UPDATE USING (auth.uid() = id OR is_admin());

-- Events Policy
-- Public leaderboard/Events readable by all
CREATE POLICY "Events readable by all" ON events FOR SELECT USING (true);
CREATE POLICY "Events writable by admins" ON events FOR ALL USING (is_admin());

-- Teams Policy
-- Anyone can see teams
CREATE POLICY "Teams readable by all" ON teams FOR SELECT USING (true);
CREATE POLICY "Users can create teams" ON teams FOR INSERT WITH CHECK (auth.uid() = created_by OR is_admin());
CREATE POLICY "Users can update their teams" ON teams FOR UPDATE USING (auth.uid() = created_by OR is_admin());
CREATE POLICY "Teams deletable by admins" ON teams FOR DELETE USING (is_admin());

-- Team Members Policy
CREATE POLICY "Team members readable by all" ON team_members FOR SELECT USING (true);
CREATE POLICY "Users can join teams" ON team_members FOR INSERT WITH CHECK (auth.uid() = user_id OR is_admin());
CREATE POLICY "Team members deletable by member or admin" ON team_members FOR DELETE USING (auth.uid() = user_id OR is_admin());

-- Question Bank Policy
CREATE POLICY "Questions readable by all participants" ON question_bank FOR SELECT USING (true);
CREATE POLICY "Questions writable by admins" ON question_bank FOR ALL USING (is_admin());

-- Event Questions Policy
-- Regular users can only see questions if an event is live
CREATE POLICY "Event questions visible to participants" ON event_questions FOR SELECT USING (true);
CREATE POLICY "Event questions writable by admins" ON event_questions FOR ALL USING (is_admin());

-- Participation Policy
-- Scores/leaderboards readable by all
CREATE POLICY "Participation readable by all" ON participation FOR SELECT USING (true);
CREATE POLICY "Users can register" ON participation FOR INSERT WITH CHECK (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can update their own progress" ON participation FOR UPDATE USING (auth.uid() = user_id OR is_admin());

-- Certificates Policy
CREATE POLICY "Users can read own certificates" ON certificates FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Certificates writable by admins" ON certificates FOR ALL USING (is_admin());

-- Email Log Policy
CREATE POLICY "Emails readable by admins" ON email_log FOR SELECT USING (is_admin());
CREATE POLICY "Emails writable by admins" ON email_log FOR ALL USING (is_admin());

-- ==========================================
-- 4. Auth Trigger (Auto-insert new auth.users)
-- ==========================================
-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar_url, college)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Unknown User'),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'college'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
