-- =========================================================
-- EventArena: Realtime Competitive Quiz Patch
-- Run this in Supabase SQL editor.
-- =========================================================

-- Add quiz_mode on events (normal/competitive)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS quiz_mode TEXT NOT NULL DEFAULT 'normal'
  CHECK (quiz_mode IN ('normal', 'competitive'));

-- Global session state for competitive quiz events
CREATE TABLE IF NOT EXISTS public.competitive_quiz_sessions (
  event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'paused', 'ended')),
  total_questions INTEGER NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  current_question_index INTEGER NOT NULL DEFAULT 0 CHECK (current_question_index >= 0),
  question_duration_seconds INTEGER NOT NULL DEFAULT 15 CHECK (question_duration_seconds >= 5),
  scoring_factor INTEGER NOT NULL DEFAULT 25 CHECK (scoring_factor >= 1),
  violation_mode TEXT NOT NULL DEFAULT 'strict' CHECK (violation_mode IN ('strict', 'penalty', 'disqualify')),
  question_start_time TIMESTAMPTZ,
  question_end_time TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Player runtime state
CREATE TABLE IF NOT EXISTS public.competitive_quiz_player_state (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'finished', 'disqualified')),
  current_question_index INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  violations INTEGER NOT NULL DEFAULT 0,
  last_points INTEGER NOT NULL DEFAULT 0,
  last_answer_correct BOOLEAN,
  last_answer_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- Per-question submissions
CREATE TABLE IF NOT EXISTS public.competitive_quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL CHECK (question_index >= 0),
  selected_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  violated BOOLEAN NOT NULL DEFAULT FALSE,
  time_taken_ms INTEGER,
  points INTEGER NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_cq_session_status
  ON public.competitive_quiz_sessions (status);

CREATE INDEX IF NOT EXISTS idx_cq_player_event_score
  ON public.competitive_quiz_player_state (event_id, total_score DESC);

CREATE INDEX IF NOT EXISTS idx_cq_answers_event_qidx
  ON public.competitive_quiz_answers (event_id, question_index);

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION public.cq_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cq_session_touch ON public.competitive_quiz_sessions;
CREATE TRIGGER trg_cq_session_touch
BEFORE UPDATE ON public.competitive_quiz_sessions
FOR EACH ROW
EXECUTE FUNCTION public.cq_touch_updated_at();

DROP TRIGGER IF EXISTS trg_cq_player_touch ON public.competitive_quiz_player_state;
CREATE TRIGGER trg_cq_player_touch
BEFORE UPDATE ON public.competitive_quiz_player_state
FOR EACH ROW
EXECUTE FUNCTION public.cq_touch_updated_at();

-- Advance question atomically when timer expires (or force=true)
CREATE OR REPLACE FUNCTION public.competitive_quiz_advance(
  p_event_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  advanced BOOLEAN,
  ended BOOLEAN,
  current_question_index INTEGER,
  question_end_time TIMESTAMPTZ,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.competitive_quiz_sessions%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT *
  INTO v_session
  FROM public.competitive_quiz_sessions
  WHERE event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, 0, NULL::TIMESTAMPTZ, 'upcoming'::TEXT;
    RETURN;
  END IF;

  IF v_session.status <> 'live' THEN
    RETURN QUERY
      SELECT FALSE, (v_session.status = 'ended'), v_session.current_question_index, v_session.question_end_time, v_session.status;
    RETURN;
  END IF;

  IF NOT p_force AND (v_session.question_end_time IS NULL OR v_session.question_end_time > v_now) THEN
    RETURN QUERY SELECT FALSE, FALSE, v_session.current_question_index, v_session.question_end_time, v_session.status;
    RETURN;
  END IF;

  IF v_session.current_question_index + 1 >= v_session.total_questions THEN
    UPDATE public.competitive_quiz_sessions
    SET status = 'ended',
        ended_at = COALESCE(ended_at, v_now),
        question_end_time = v_now
    WHERE event_id = p_event_id;

    UPDATE public.events
    SET status = 'ended', end_at = COALESCE(end_at, v_now)
    WHERE id = p_event_id;

    UPDATE public.competitive_quiz_player_state
    SET status = CASE WHEN status = 'disqualified' THEN status ELSE 'finished' END
    WHERE event_id = p_event_id;

    RETURN QUERY SELECT TRUE, TRUE, v_session.current_question_index, v_now, 'ended'::TEXT;
    RETURN;
  END IF;

  UPDATE public.competitive_quiz_sessions
  SET current_question_index = v_session.current_question_index + 1,
      question_start_time = v_now,
      question_end_time = v_now + make_interval(secs => v_session.question_duration_seconds)
  WHERE event_id = p_event_id;

  UPDATE public.competitive_quiz_player_state
  SET current_question_index = v_session.current_question_index + 1
  WHERE event_id = p_event_id
    AND status = 'playing';

  RETURN QUERY
    SELECT TRUE, FALSE,
      v_session.current_question_index + 1,
      v_now + make_interval(secs => v_session.question_duration_seconds),
      'live'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.competitive_quiz_advance(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.competitive_quiz_advance(UUID, BOOLEAN) TO service_role;

-- Keep competitive sessions aligned with event lifecycle
CREATE OR REPLACE FUNCTION public.competitive_quiz_sync_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_questions INTEGER;
  v_mode TEXT;
BEGIN
  IF NEW.type <> 'quiz' THEN
    RETURN NEW;
  END IF;

  v_mode := COALESCE(NEW.quiz_mode, 'normal');
  IF v_mode <> 'competitive' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO v_total_questions
  FROM public.event_questions
  WHERE event_id = NEW.id;

  INSERT INTO public.competitive_quiz_sessions (
    event_id,
    status,
    total_questions,
    current_question_index,
    question_start_time,
    question_end_time,
    started_at,
    ended_at
  )
  VALUES (
    NEW.id,
    CASE WHEN NEW.status = 'ended' THEN 'ended' WHEN NEW.status = 'live' THEN 'live' ELSE 'upcoming' END,
    v_total_questions,
    0,
    CASE WHEN NEW.status = 'live' THEN COALESCE(NEW.start_at, NOW()) ELSE NULL END,
    CASE WHEN NEW.status = 'live' THEN COALESCE(NEW.start_at, NOW()) + make_interval(secs => 15) ELSE NULL END,
    CASE WHEN NEW.status = 'live' THEN COALESCE(NEW.start_at, NOW()) ELSE NULL END,
    CASE WHEN NEW.status = 'ended' THEN COALESCE(NEW.end_at, NOW()) ELSE NULL END
  )
  ON CONFLICT (event_id)
  DO UPDATE SET
    total_questions = EXCLUDED.total_questions,
    status = EXCLUDED.status,
    started_at = CASE
      WHEN EXCLUDED.status = 'live' THEN COALESCE(public.competitive_quiz_sessions.started_at, EXCLUDED.started_at)
      ELSE public.competitive_quiz_sessions.started_at
    END,
    question_start_time = CASE
      WHEN EXCLUDED.status = 'live' THEN COALESCE(public.competitive_quiz_sessions.question_start_time, EXCLUDED.question_start_time)
      ELSE public.competitive_quiz_sessions.question_start_time
    END,
    question_end_time = CASE
      WHEN EXCLUDED.status = 'live' THEN COALESCE(public.competitive_quiz_sessions.question_end_time, EXCLUDED.question_end_time)
      WHEN EXCLUDED.status = 'ended' THEN COALESCE(public.competitive_quiz_sessions.question_end_time, NOW())
      ELSE public.competitive_quiz_sessions.question_end_time
    END,
    ended_at = CASE
      WHEN EXCLUDED.status = 'ended' THEN COALESCE(public.competitive_quiz_sessions.ended_at, EXCLUDED.ended_at)
      ELSE public.competitive_quiz_sessions.ended_at
    END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_competitive_quiz_sync_from_event ON public.events;
CREATE TRIGGER trg_competitive_quiz_sync_from_event
AFTER INSERT OR UPDATE OF status, start_at, end_at, type, quiz_mode ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.competitive_quiz_sync_from_event();

-- RLS
ALTER TABLE public.competitive_quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitive_quiz_player_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitive_quiz_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CQ sessions readable by all" ON public.competitive_quiz_sessions;
CREATE POLICY "CQ sessions readable by all"
  ON public.competitive_quiz_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "CQ sessions writable by admins" ON public.competitive_quiz_sessions;
CREATE POLICY "CQ sessions writable by admins"
  ON public.competitive_quiz_sessions FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "CQ player state readable own or admin" ON public.competitive_quiz_player_state;
CREATE POLICY "CQ player state readable own or admin"
  ON public.competitive_quiz_player_state FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "CQ player state insert own or admin" ON public.competitive_quiz_player_state;
CREATE POLICY "CQ player state insert own or admin"
  ON public.competitive_quiz_player_state FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "CQ player state update own or admin" ON public.competitive_quiz_player_state;
CREATE POLICY "CQ player state update own or admin"
  ON public.competitive_quiz_player_state FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "CQ answers readable own or admin" ON public.competitive_quiz_answers;
CREATE POLICY "CQ answers readable own or admin"
  ON public.competitive_quiz_answers FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "CQ answers insert own or admin" ON public.competitive_quiz_answers;
CREATE POLICY "CQ answers insert own or admin"
  ON public.competitive_quiz_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "CQ answers update admin only" ON public.competitive_quiz_answers;
CREATE POLICY "CQ answers update admin only"
  ON public.competitive_quiz_answers FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
