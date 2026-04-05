-- Step 1a: Add coding_challenge to the event_type enum
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'coding_challenge';

-- Step 1b: coding_problems table
-- One problem per coding_challenge event (one problem per event for simplicity)
CREATE TABLE IF NOT EXISTS coding_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  statement TEXT NOT NULL,       -- full markdown problem description
  input_format TEXT NOT NULL,    -- description of input format
  output_format TEXT NOT NULL,   -- description of output format
  constraints TEXT,              -- constraints like 1 <= N <= 10^5
  time_limit_ms INTEGER DEFAULT 3000,   -- execution time limit per test case in ms
  points_per_testcase INTEGER DEFAULT 2, -- points awarded per passing test case
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id)               -- one problem per event
);

-- Step 1c: coding_test_cases table
CREATE TABLE IF NOT EXISTS coding_test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES coding_problems(id) ON DELETE CASCADE,
  input TEXT NOT NULL,           -- exact stdin input to feed the program
  expected_output TEXT NOT NULL, -- exact expected stdout output (will be trimmed before compare)
  is_hidden BOOLEAN DEFAULT true,  -- true = hidden from student, used for scoring only
  order_num INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 1d: coding_submissions table
CREATE TABLE IF NOT EXISTS coding_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES coding_problems(id) ON DELETE CASCADE,
  code TEXT NOT NULL,            -- the student's full submitted C++ code
  language TEXT DEFAULT 'cpp',
  test_results JSONB DEFAULT '[]'::jsonb,
  -- test_results shape: [{ test_case_id, passed: bool, is_hidden: bool, runtime_ms: number }]
  passed_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  violations INTEGER DEFAULT 0
);

-- Step 1e: RLS policies
ALTER TABLE coding_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_submissions ENABLE ROW LEVEL SECURITY;

-- coding_problems: anyone can read, only admin can write
CREATE POLICY "Anyone read coding problems" ON coding_problems FOR SELECT USING (true);
CREATE POLICY "Admin all coding problems" ON coding_problems FOR ALL USING (is_admin());

-- coding_test_cases: students can only read non-hidden test cases
-- hidden test cases are fetched server-side only during judge (we handle this in frontend logic)
CREATE POLICY "Anyone read visible test cases" ON coding_test_cases
  FOR SELECT USING (is_hidden = false);
CREATE POLICY "Admin all test cases" ON coding_test_cases FOR ALL USING (is_admin());

-- coding_submissions: users can read/write their own, admin reads all
CREATE POLICY "Users manage own submissions" ON coding_submissions
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admin read all submissions" ON coding_submissions
  FOR SELECT USING (is_admin());
