-- Step 1a: Add new columns to question_bank for simulation questions
-- These columns are NULL for regular MCQ questions, populated only for simulation type
ALTER TABLE question_bank
  ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'mcq',
  ADD COLUMN IF NOT EXISTS wokwi_url TEXT,
  ADD COLUMN IF NOT EXISTS sim_instructions TEXT,
  ADD COLUMN IF NOT EXISTS sim_expected_output TEXT,
  ADD COLUMN IF NOT EXISTS sim_marks INTEGER DEFAULT 10;

-- Step 1b: simulation_submissions table
-- One row per student per simulation question per event
CREATE TABLE IF NOT EXISTS simulation_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  participation_id UUID NOT NULL REFERENCES participation(id) ON DELETE CASCADE,
  screenshot_url TEXT NOT NULL,         -- Cloudinary URL of the uploaded screenshot
  screenshot_public_id TEXT NOT NULL,   -- Cloudinary public_id for deletion
  watermark_code TEXT NOT NULL,         -- random 6-char code shown in overlay during exam
  status TEXT DEFAULT 'pending',        -- 'pending' | 'approved' | 'rejected'
  admin_note TEXT,                      -- optional rejection reason from admin
  marks_awarded INTEGER DEFAULT 0,      -- set by admin on approve (= question.sim_marks)
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, question_id, event_id) -- one submission per student per question per event
);

-- Step 1c: RLS
ALTER TABLE simulation_submissions ENABLE ROW LEVEL SECURITY;

-- Students can insert their own and read their own
CREATE POLICY "Users insert own sim submissions" ON simulation_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own sim submissions" ON simulation_submissions
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- Admin can update (approve/reject) and read all
CREATE POLICY "Admin update sim submissions" ON simulation_submissions
  FOR UPDATE USING (is_admin());
