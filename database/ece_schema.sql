-- ═══════════════════════════════════════════════════════════════
-- ECE Hub — New Tables (ONLY ADD, NEVER MODIFY existing tables)
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Table 1: ECE Topics (mind map nodes)
CREATE TABLE IF NOT EXISTS ece_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  icon_public_id TEXT,
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  order_num INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: ECE Resources (PDFs, videos, career paths)
CREATE TABLE IF NOT EXISTS ece_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES ece_topics(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'video', 'image', 'career')),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  public_id TEXT,
  thumbnail_url TEXT,
  youtube_id TEXT,
  order_num INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: ECE Notices
CREATE TABLE IF NOT EXISTS ece_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'urgent', 'exam', 'lab', 'event')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Table 4: ECE Gallery
CREATE TABLE IF NOT EXISTS ece_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  public_id TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('lab', 'project', 'event', 'batch', 'general')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 5: ECE Doubts (anonymous Q&A)
CREATE TABLE IF NOT EXISTS ece_doubts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES ece_topics(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  admin_reply TEXT,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 6: ECE Chat (real-time community chat)
CREATE TABLE IF NOT EXISTS ece_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 7: ECE Quotes (motivational quotes)
CREATE TABLE IF NOT EXISTS ece_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  author TEXT DEFAULT 'Anonymous',
  category TEXT DEFAULT 'motivation' CHECK (category IN ('motivation', 'exam', 'cheat', 'failure', 'inspiration')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 8: ECE Organisation info
CREATE TABLE IF NOT EXISTS ece_organisation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_name TEXT NOT NULL,
  department TEXT NOT NULL,
  hod_name TEXT NOT NULL,
  hod_message TEXT,
  acknowledgements TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 9: ECE Creators (platform developers)
CREATE TABLE IF NOT EXISTS ece_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  photo_url TEXT,
  photo_public_id TEXT,
  instagram TEXT,
  github TEXT,
  phone TEXT,
  order_num INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 10: ECE Faculty
CREATE TABLE IF NOT EXISTS ece_faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  designation TEXT,
  quote TEXT,
  photo_url TEXT,
  photo_public_id TEXT,
  order_num INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE ece_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ece_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ece_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ece_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE ece_doubts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ece_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE ece_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ece_organisation ENABLE ROW LEVEL SECURITY;
ALTER TABLE ece_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE ece_faculty ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read topics"       ON ece_topics       FOR SELECT USING (true);
CREATE POLICY "Public read resources"    ON ece_resources    FOR SELECT USING (true);
CREATE POLICY "Public read notices"      ON ece_notices      FOR SELECT USING (is_active = true);
CREATE POLICY "Public read gallery"      ON ece_gallery      FOR SELECT USING (true);
CREATE POLICY "Public read quotes"       ON ece_quotes       FOR SELECT USING (is_active = true);
CREATE POLICY "Public read organisation" ON ece_organisation FOR SELECT USING (true);
CREATE POLICY "Public read creators"     ON ece_creators     FOR SELECT USING (true);
CREATE POLICY "Public read faculty"      ON ece_faculty      FOR SELECT USING (true);

-- Auth (logged in) policies
-- FIX 4: Auth policy — any logged-in user can read ALL doubts (public Q&A board)
CREATE POLICY "Auth read all doubts" ON ece_doubts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read chat"       ON ece_chat   FOR SELECT USING (true);
CREATE POLICY "Auth insert chat"     ON ece_chat   FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Auth insert doubt"    ON ece_doubts FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Admin full control policies
CREATE POLICY "Admin all topics"       ON ece_topics       FOR ALL USING (is_admin());
CREATE POLICY "Admin all resources"    ON ece_resources    FOR ALL USING (is_admin());
CREATE POLICY "Admin all notices"      ON ece_notices      FOR ALL USING (is_admin());
CREATE POLICY "Admin all gallery"      ON ece_gallery      FOR ALL USING (is_admin());
CREATE POLICY "Admin all doubts"       ON ece_doubts       FOR ALL USING (is_admin());
CREATE POLICY "Admin all chat"         ON ece_chat         FOR ALL USING (is_admin());
CREATE POLICY "Admin all quotes"       ON ece_quotes       FOR ALL USING (is_admin());
CREATE POLICY "Admin all organisation" ON ece_organisation FOR ALL USING (is_admin());
CREATE POLICY "Admin all creators"     ON ece_creators     FOR ALL USING (is_admin());
CREATE POLICY "Admin all faculty"      ON ece_faculty      FOR ALL USING (is_admin());

-- ═══════════════════════════════════════════════════════════════
-- Seed Data — Default Motivational Quotes
-- ═══════════════════════════════════════════════════════════════
INSERT INTO ece_quotes (text, author, category) VALUES
  ('The real grade is what you know, not what you copied.', 'Inspiration', 'cheat'),
  ('Shortcuts skip the learning, not the exam.', 'Wisdom', 'exam'),
  ('Failure is just the first attempt in learning.', 'Inspiration', 'failure'),
  ('Every expert was once a beginner.', 'Motivation', 'motivation'),
  ('Your consistency today is your certificate tomorrow.', 'Motivation', 'motivation'),
  ('One loss doesn''t define your journey.', 'Inspiration', 'failure'),
  ('Study not to pass but to know.', 'Wisdom', 'exam')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- FIX 4: Replace restrictive SELECT policy with public Q&A policy
-- Run in Supabase SQL Editor:
-- DROP POLICY IF EXISTS "Auth read doubts own" ON ece_doubts;
-- DROP POLICY IF EXISTS "Auth read all doubts" ON ece_doubts;
-- CREATE POLICY "Auth read all doubts" ON ece_doubts
--   FOR SELECT USING (auth.uid() IS NOT NULL);
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- FIX 5: Enable REPLICA IDENTITY FULL so DELETE realtime events
-- include payload.old.id (needed for live chat message removal).
-- Run in Supabase SQL Editor:
ALTER TABLE ece_chat REPLICA IDENTITY FULL;
-- ═══════════════════════════════════════════════════════════════
