-- ==========================================
-- You & Me 1v1 Game Mode System
-- Strategy + Quiz Competitive Mode
-- ==========================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS youandme_answers CASCADE;
DROP TABLE IF EXISTS youandme_selections CASCADE;
DROP TABLE IF EXISTS youandme_player_state CASCADE;
DROP TABLE IF EXISTS youandme_rounds CASCADE;
DROP TABLE IF EXISTS youandme_sessions CASCADE;

-- Drop existing custom types if they exist
DROP TYPE IF EXISTS youandme_status CASCADE;
DROP TYPE IF EXISTS youandme_phase CASCADE;
DROP TYPE IF EXISTS player_youandme_status CASCADE;

-- Create custom types
CREATE TYPE youandme_status AS ENUM ('pending', 'selection', 'answering', 'tie_break', 'ended');
CREATE TYPE youandme_phase AS ENUM ('selection_1', 'answering_1', 'selection_2', 'answering_2', 'evaluation', 'tie_break_round1', 'tie_break_round2', 'sudden_death', 'finished');
CREATE TYPE player_youandme_status AS ENUM ('selecting', 'answering', 'waiting', 'tie_break', 'finished');

-- 1. YOU & ME SESSIONS (global match state)
CREATE TABLE youandme_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status youandme_status DEFAULT 'pending',
  current_phase youandme_phase DEFAULT 'selection_1',
  question_pool_size INTEGER NOT NULL,
  questions_used INTEGER DEFAULT 0,
  player1_score INTEGER DEFAULT 0,
  player2_score INTEGER DEFAULT 0,
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, player1_id, player2_id)
);

-- 2. YOU & ME ROUNDS (phase progression tracking)
CREATE TABLE youandme_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES youandme_sessions(id) ON DELETE CASCADE,
  phase youandme_phase NOT NULL,
  round_number INTEGER,
  total_questions INTEGER,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, phase)
);

-- 3. QUESTION SELECTIONS (tracks who picked what for whom)
CREATE TABLE youandme_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES youandme_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  selected_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  for_player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, question_id)
);

-- 4. YOU & ME ANSWERS (submission tracking)
CREATE TABLE youandme_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES youandme_sessions(id) ON DELETE CASCADE,
  phase youandme_phase NOT NULL,
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_answer TEXT NOT NULL,
  is_correct BOOLEAN,
  time_taken_ms INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, phase, question_id, player_id)
);

-- 5. YOU & ME PLAYER STATE (per-player status tracking)
CREATE TABLE youandme_player_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES youandme_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status player_youandme_status DEFAULT 'waiting',
  selection_count INTEGER DEFAULT 0,
  answer_count INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);

-- ==========================================
-- INDEXES for Performance
-- ==========================================

CREATE INDEX idx_youandme_sessions_event ON youandme_sessions(event_id);
CREATE INDEX idx_youandme_sessions_players ON youandme_sessions(player1_id, player2_id);
CREATE INDEX idx_youandme_sessions_status ON youandme_sessions(status);
CREATE INDEX idx_youandme_rounds_session ON youandme_rounds(session_id);
CREATE INDEX idx_youandme_selections_session ON youandme_selections(session_id);
CREATE INDEX idx_youandme_selections_question ON youandme_selections(question_id);
CREATE INDEX idx_youandme_answers_session ON youandme_answers(session_id);
CREATE INDEX idx_youandme_answers_phase ON youandme_answers(phase);
CREATE INDEX idx_youandme_player_state_session ON youandme_player_state(session_id);
CREATE INDEX idx_youandme_player_state_player ON youandme_player_state(player_id);

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Function: Initialize a You & Me match
CREATE OR REPLACE FUNCTION youandme_init_match(
  p_event_id UUID,
  p_player1_id UUID,
  p_player2_id UUID
) RETURNS jsonb AS $$
DECLARE
  v_session_id UUID;
  v_question_count INTEGER;
BEGIN
  -- Get question count for event
  SELECT COUNT(*) INTO v_question_count FROM question_bank 
    WHERE event_id = p_event_id AND active = true;
  
  IF v_question_count < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough questions for match');
  END IF;

  -- Create session
  INSERT INTO youandme_sessions (
    event_id, player1_id, player2_id, 
    question_pool_size, status, current_phase
  ) VALUES (
    p_event_id, p_player1_id, p_player2_id,
    v_question_count, 'selection', 'selection_1'
  ) RETURNING id INTO v_session_id;

  -- Initialize player states
  INSERT INTO youandme_player_state (session_id, player_id, status)
  VALUES 
    (v_session_id, p_player1_id, 'selecting'),
    (v_session_id, p_player2_id, 'waiting');

  -- Create initial round
  INSERT INTO youandme_rounds (session_id, phase, round_number, total_questions, started_at)
  VALUES (v_session_id, 'selection_1', 1, v_question_count, NOW());

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'question_count', v_question_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Get available questions (exclude already selected)
CREATE OR REPLACE FUNCTION youandme_get_available_questions(
  p_session_id UUID
) RETURNS SETOF jsonb AS $$
BEGIN
  RETURN QUERY
  SELECT jsonb_build_object(
    'id', q.id,
    'text', q.question_text,
    'options', q.options,
    'difficulty', q.difficulty
  )
  FROM question_bank q
  WHERE q.event_id = (SELECT event_id FROM youandme_sessions WHERE id = p_session_id)
    AND q.active = true
    AND q.id NOT IN (SELECT question_id FROM youandme_selections WHERE session_id = p_session_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Record question selection and lock it
CREATE OR REPLACE FUNCTION youandme_select_question(
  p_session_id UUID,
  p_question_id UUID,
  p_selected_by_id UUID
) RETURNS jsonb AS $$
DECLARE
  v_session RECORD;
  v_for_player_id UUID;
  v_is_player1 BOOLEAN;
  v_next_phase youandme_phase;
BEGIN
  -- Get session and determine opponent
  SELECT * INTO v_session FROM youandme_sessions WHERE id = p_session_id FOR UPDATE;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  -- Determine which player is selecting
  v_is_player1 := (p_selected_by_id = v_session.player1_id);
  v_for_player_id := CASE WHEN v_is_player1 THEN v_session.player2_id ELSE v_session.player1_id END;

  -- Check if question already selected
  IF EXISTS (SELECT 1 FROM youandme_selections WHERE session_id = p_session_id AND question_id = p_question_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Question already selected');
  END IF;

  -- Only allow selections during selection phases
  IF v_session.current_phase NOT IN ('selection_1', 'selection_2') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selection is not allowed in current phase');
  END IF;

  v_next_phase := CASE
    WHEN v_session.current_phase = 'selection_1' THEN 'answering_1'
    WHEN v_session.current_phase = 'selection_2' THEN 'answering_2'
    ELSE v_session.current_phase
  END;

  -- Record selection
  INSERT INTO youandme_selections (session_id, question_id, selected_by_id, for_player_id)
  VALUES (p_session_id, p_question_id, p_selected_by_id, v_for_player_id);

  -- Move session to answering phase once a question is selected
  UPDATE youandme_sessions
  SET
    current_phase = v_next_phase,
    questions_used = questions_used + 1,
    updated_at = NOW()
  WHERE id = p_session_id;

  -- Update player state
  UPDATE youandme_player_state 
  SET 
    status = 'waiting',
    selection_count = selection_count + 1,
    updated_at = NOW()
  WHERE session_id = p_session_id AND player_id = p_selected_by_id;

  -- Transition opponent to answering
  UPDATE youandme_player_state 
  SET status = 'answering'
  WHERE session_id = p_session_id AND player_id = v_for_player_id;

  RETURN jsonb_build_object(
    'success', true,
    'question_id', p_question_id,
    'for_player_id', v_for_player_id,
    'selected_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Record answer and check if phase should end
CREATE OR REPLACE FUNCTION youandme_submit_answer(
  p_session_id UUID,
  p_phase youandme_phase,
  p_question_id UUID,
  p_player_id UUID,
  p_answer TEXT,
  p_is_correct BOOLEAN,
  p_time_ms INTEGER
) RETURNS jsonb AS $$
DECLARE
  v_session RECORD;
  v_answered_count INTEGER;
  v_phase_complete BOOLEAN := false;
  v_other_player_id UUID;
BEGIN
  -- Lock session
  SELECT * INTO v_session FROM youandme_sessions WHERE id = p_session_id FOR UPDATE;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  -- Record answer
  INSERT INTO youandme_answers (session_id, phase, question_id, player_id, submitted_answer, is_correct, time_taken_ms)
  VALUES (p_session_id, p_phase, p_question_id, p_player_id, p_answer, p_is_correct, p_time_ms);

  -- Update player score
  IF p_is_correct THEN
    UPDATE youandme_player_state 
    SET 
      correct_answers = correct_answers + 1,
      total_score = total_score + (1000 - (p_time_ms / 100))::INTEGER,
      answer_count = answer_count + 1,
      updated_at = NOW()
    WHERE session_id = p_session_id AND player_id = p_player_id;
  ELSE
    UPDATE youandme_player_state 
    SET 
      answer_count = answer_count + 1,
      updated_at = NOW()
    WHERE session_id = p_session_id AND player_id = p_player_id;
  END IF;

  -- Check if phase complete
  SELECT COUNT(DISTINCT question_id) INTO v_answered_count FROM youandme_answers 
    WHERE session_id = p_session_id AND phase = p_phase;

  v_other_player_id := CASE
    WHEN p_player_id = v_session.player1_id THEN v_session.player2_id
    ELSE v_session.player1_id
  END;

  -- Each answering phase expects a single answer from the targeted player.
  -- Transition immediately after that answer is recorded.
  IF p_phase = 'answering_1' AND v_answered_count >= 1 THEN
    v_phase_complete := true;

    UPDATE youandme_sessions
    SET current_phase = 'selection_2', updated_at = NOW()
    WHERE id = p_session_id;

    UPDATE youandme_player_state
    SET status = 'selecting', updated_at = NOW()
    WHERE session_id = p_session_id AND player_id = p_player_id;

    UPDATE youandme_player_state
    SET status = 'waiting', updated_at = NOW()
    WHERE session_id = p_session_id AND player_id = v_other_player_id;
  ELSIF p_phase = 'answering_2' AND v_answered_count >= 1 THEN
    v_phase_complete := true;

    -- Finalize the match after second answering phase.
    PERFORM youandme_evaluate_scores(p_session_id);

    UPDATE youandme_player_state
    SET status = 'finished', updated_at = NOW()
    WHERE session_id = p_session_id;
  ELSIF p_phase IN ('tie_break_round1', 'tie_break_round2', 'sudden_death') THEN
    v_phase_complete := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_correct', p_is_correct,
    'phase_complete', v_phase_complete
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Evaluate scores and determine if tie-break needed
CREATE OR REPLACE FUNCTION youandme_evaluate_scores(
  p_session_id UUID
) RETURNS jsonb AS $$
DECLARE
  v_session RECORD;
  v_player1_score INTEGER;
  v_player2_score INTEGER;
  v_next_phase youandme_phase;
BEGIN
  SELECT * INTO v_session FROM youandme_sessions WHERE id = p_session_id FOR UPDATE;

  -- Calculate scores (correct answer count)
  SELECT COUNT(*) INTO v_player1_score FROM youandme_answers 
    WHERE session_id = p_session_id AND player_id = v_session.player1_id AND is_correct = true;
  
  SELECT COUNT(*) INTO v_player2_score FROM youandme_answers 
    WHERE session_id = p_session_id AND player_id = v_session.player2_id AND is_correct = true;

  -- Update session scores
  UPDATE youandme_sessions 
  SET 
    player1_score = v_player1_score,
    player2_score = v_player2_score,
    status = 'ended',
    current_phase = 'finished',
    winner_id = CASE 
      WHEN v_player1_score > v_player2_score THEN v_session.player1_id
      WHEN v_player2_score > v_player1_score THEN v_session.player2_id
      ELSE NULL
    END,
    ended_at = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id;

  UPDATE youandme_player_state
  SET status = 'finished', updated_at = NOW()
  WHERE session_id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'player1_score', v_player1_score,
    'player2_score', v_player2_score,
    'is_tie', v_player1_score = v_player2_score,
    'winner_id', CASE WHEN v_player1_score > v_player2_score THEN v_session.player1_id
                      WHEN v_player2_score > v_player1_score THEN v_session.player2_id
                      ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE youandme_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE youandme_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE youandme_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE youandme_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE youandme_player_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies: youandme_sessions (readable by participants and admins)
CREATE POLICY "youandme_sessions_readable" ON youandme_sessions FOR SELECT 
  USING (auth.uid() = player1_id OR auth.uid() = player2_id OR 
         auth.uid() IN (SELECT created_by FROM events WHERE id = event_id));

CREATE POLICY "youandme_sessions_admin_insert" ON youandme_sessions FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT created_by FROM events WHERE id = event_id)
);

CREATE POLICY "youandme_sessions_update" ON youandme_sessions FOR UPDATE USING (
  auth.uid() = player1_id OR auth.uid() = player2_id OR
  auth.uid() IN (SELECT created_by FROM events WHERE id = event_id)
);

-- RLS Policies: youandme_rounds (readable by all)
CREATE POLICY "youandme_rounds_readable" ON youandme_rounds FOR SELECT USING (true);

-- RLS Policies: youandme_selections (readable by all)
CREATE POLICY "youandme_selections_readable" ON youandme_selections FOR SELECT USING (true);

CREATE POLICY "youandme_selections_insert" ON youandme_selections FOR INSERT 
  WITH CHECK (auth.uid() = selected_by_id);

-- RLS Policies: youandme_answers (players submit own, all can read)
CREATE POLICY "youandme_answers_readable" ON youandme_answers FOR SELECT USING (true);

CREATE POLICY "youandme_answers_insert" ON youandme_answers FOR INSERT 
  WITH CHECK (auth.uid() = player_id);

-- RLS Policies: youandme_player_state (readable by participant and admin)
CREATE POLICY "youandme_player_state_readable" ON youandme_player_state FOR SELECT 
  USING (auth.uid() = player_id OR 
         auth.uid() IN (SELECT created_by FROM events 
                       WHERE id = (SELECT event_id FROM youandme_sessions 
                                  WHERE id = session_id)));

-- ==========================================
-- TRIGGERS for automatic updates
-- ==========================================

CREATE OR REPLACE FUNCTION update_youandme_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_youandme_sessions_updated_at
BEFORE UPDATE ON youandme_sessions
FOR EACH ROW
EXECUTE FUNCTION update_youandme_sessions_updated_at();

CREATE OR REPLACE FUNCTION update_youandme_rounds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_youandme_rounds_updated_at
BEFORE UPDATE ON youandme_rounds
FOR EACH ROW
EXECUTE FUNCTION update_youandme_rounds_updated_at();

CREATE OR REPLACE FUNCTION update_youandme_player_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_youandme_player_state_updated_at
BEFORE UPDATE ON youandme_player_state
FOR EACH ROW
EXECUTE FUNCTION update_youandme_player_state_updated_at();

-- ==========================================
-- Update events table to support You & Me mode
-- ==========================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS youandme_enabled BOOLEAN DEFAULT false;

-- ==========================================
-- Done
-- ==========================================

COMMIT;
