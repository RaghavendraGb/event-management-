-- =========================================================
-- Event mode compatibility patch (safe to run multiple times)
-- Ensures DB supports all event modes used by Admin GUI.
-- =========================================================

-- Extend event_type enum with missing values used by frontend.
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'youandme';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'coding_challenge';

-- Ensure events table has mode columns used by admin create/update flows.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS quiz_mode TEXT NOT NULL DEFAULT 'normal'
  CHECK (quiz_mode IN ('normal', 'competitive'));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS rapid_fire_style TEXT NOT NULL DEFAULT 'traditional'
  CHECK (rapid_fire_style IN ('traditional', 'knockout_tournament'));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS youandme_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS results_announced BOOLEAN NOT NULL DEFAULT false;

-- Centralized control metadata for synchronized realtime rendering.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS current_question_index INTEGER NOT NULL DEFAULT 0
  CHECK (current_question_index >= 0);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS question_end_at TIMESTAMPTZ;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS state_version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS controller_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Server-backed live session ownership for multi-tab protection.
ALTER TABLE public.participation
  ADD COLUMN IF NOT EXISTS active_session_id UUID;

ALTER TABLE public.participation
  ADD COLUMN IF NOT EXISTS active_session_started_at TIMESTAMPTZ;

ALTER TABLE public.participation
  ADD COLUMN IF NOT EXISTS active_session_heartbeat_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_participation_active_session
  ON public.participation (event_id, user_id, active_session_id);

-- Helpful index for result-gate checks.
CREATE INDEX IF NOT EXISTS idx_events_result_gate
  ON public.events (status, results_announced);

CREATE INDEX IF NOT EXISTS idx_events_state_sync
  ON public.events (id, state_version, status, current_question_index, question_end_at);

CREATE INDEX IF NOT EXISTS idx_participation_event_user_status
  ON public.participation (event_id, user_id, status);

-- Bump event state version whenever synchronized fields change.
CREATE OR REPLACE FUNCTION public.bump_event_state_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.current_question_index IS DISTINCT FROM OLD.current_question_index OR
    NEW.question_end_at IS DISTINCT FROM OLD.question_end_at OR
    NEW.results_announced IS DISTINCT FROM OLD.results_announced OR
    NEW.start_at IS DISTINCT FROM OLD.start_at OR
    NEW.end_at IS DISTINCT FROM OLD.end_at
  ) THEN
    NEW.state_version := COALESCE(OLD.state_version, 0) + 1;
  ELSE
    NEW.state_version := COALESCE(OLD.state_version, 0);
  END IF;

  NEW.controller_updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_state_version ON public.events;
CREATE TRIGGER trg_events_state_version
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.bump_event_state_version();

-- Admin-only centralized event controller RPC.
CREATE OR REPLACE FUNCTION public.admin_control_event(
  p_event_id UUID,
  p_action TEXT,
  p_question_duration_seconds INTEGER DEFAULT 15,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  ok BOOLEAN,
  status TEXT,
  current_question_index INTEGER,
  question_end_at TIMESTAMPTZ,
  state_version BIGINT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_duration INTEGER := GREATEST(5, COALESCE(p_question_duration_seconds, 15));
  v_action TEXT := LOWER(COALESCE(p_action, ''));
  v_total_questions INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  SELECT *
  INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 0, NULL::TIMESTAMPTZ, 0::BIGINT, 'Event not found';
    RETURN;
  END IF;

  IF v_action = 'start' THEN
    IF v_event.status = 'ended' AND NOT p_force THEN
      RETURN QUERY SELECT FALSE, v_event.status::TEXT, COALESCE(v_event.current_question_index, 0), v_event.question_end_at, v_event.state_version, 'Event already ended';
      RETURN;
    END IF;

    SELECT COUNT(*)
    INTO v_total_questions
    FROM public.event_questions
    WHERE event_id = p_event_id;

    UPDATE public.events AS e
    SET status = 'live',
        start_at = COALESCE(start_at, v_now),
        current_question_index = CASE
          WHEN e.type = 'quiz' AND COALESCE(e.quiz_mode, 'normal') = 'competitive' THEN 0
          ELSE COALESCE(e.current_question_index, 0)
        END,
        question_end_at = CASE
          WHEN e.type = 'quiz' AND COALESCE(e.quiz_mode, 'normal') = 'competitive'
            THEN v_now + make_interval(secs => v_duration)
          ELSE e.question_end_at
        END,
        results_announced = FALSE
    WHERE id = p_event_id
    RETURNING * INTO v_event;

    IF v_event.type = 'quiz' AND COALESCE(v_event.quiz_mode, 'normal') = 'competitive' THEN
      IF to_regclass('public.competitive_quiz_sessions') IS NOT NULL THEN
        EXECUTE '
          INSERT INTO public.competitive_quiz_sessions (
            event_id,
            status,
            total_questions,
            current_question_index,
            question_duration_seconds,
            question_start_time,
            question_end_time,
            started_at,
            ended_at
          ) VALUES ($1, ''live'', $2, 0, $3, $4, $5, $4, NULL)
          ON CONFLICT (event_id)
          DO UPDATE SET
            status = ''live'',
            total_questions = EXCLUDED.total_questions,
            current_question_index = 0,
            question_duration_seconds = EXCLUDED.question_duration_seconds,
            question_start_time = EXCLUDED.question_start_time,
            question_end_time = EXCLUDED.question_end_time,
            started_at = COALESCE(public.competitive_quiz_sessions.started_at, EXCLUDED.started_at),
            ended_at = NULL
        '
        USING p_event_id, v_total_questions, v_duration, v_now, v_now + make_interval(secs => v_duration);
      END IF;
    ELSIF v_event.type = 'treasure_hunt' THEN
      IF to_regclass('public.treasure_hunt_sessions') IS NOT NULL THEN
        EXECUTE '
          INSERT INTO public.treasure_hunt_sessions (event_id, total_stages, status, start_time, end_time)
          VALUES (
            $1,
            COALESCE((SELECT MAX(stage) FROM public.treasure_hunt_stage_questions WHERE event_id = $1 AND is_active = TRUE),
                     (SELECT MAX(order_num) FROM public.event_questions WHERE event_id = $1),
                     1),
            ''live'',
            $2,
            NULL
          )
          ON CONFLICT (event_id)
          DO UPDATE SET
            status = ''live'',
            start_time = COALESCE(public.treasure_hunt_sessions.start_time, EXCLUDED.start_time),
            end_time = NULL
        '
        USING p_event_id, v_now;
      END IF;
    END IF;

  ELSIF v_action = 'pause' THEN
    IF v_event.type <> 'quiz' OR COALESCE(v_event.quiz_mode, 'normal') <> 'competitive' THEN
      RETURN QUERY SELECT FALSE, v_event.status::TEXT, COALESCE(v_event.current_question_index, 0), v_event.question_end_at, v_event.state_version, 'Pause only supported for competitive quiz';
      RETURN;
    END IF;

    IF to_regclass('public.competitive_quiz_sessions') IS NOT NULL THEN
      EXECUTE 'UPDATE public.competitive_quiz_sessions SET status = ''paused'' WHERE event_id = $1'
      USING p_event_id;
    END IF;

  ELSIF v_action = 'resume' THEN
    IF v_event.type <> 'quiz' OR COALESCE(v_event.quiz_mode, 'normal') <> 'competitive' THEN
      RETURN QUERY SELECT FALSE, v_event.status::TEXT, COALESCE(v_event.current_question_index, 0), v_event.question_end_at, v_event.state_version, 'Resume only supported for competitive quiz';
      RETURN;
    END IF;

    IF to_regclass('public.competitive_quiz_sessions') IS NOT NULL THEN
      EXECUTE '
        UPDATE public.competitive_quiz_sessions
        SET status = ''live'',
            question_start_time = $2,
            question_end_time = $3
        WHERE event_id = $1
      '
      USING p_event_id, v_now, v_now + make_interval(secs => v_duration);
    END IF;

    UPDATE public.events
    SET question_end_at = v_now + make_interval(secs => v_duration)
    WHERE id = p_event_id
    RETURNING * INTO v_event;

  ELSIF v_action IN ('end', 'force_end') THEN
    UPDATE public.events
    SET status = 'ended',
        end_at = COALESCE(end_at, v_now),
        question_end_at = v_now
    WHERE id = p_event_id
    RETURNING * INTO v_event;

    IF v_event.type = 'quiz' AND COALESCE(v_event.quiz_mode, 'normal') = 'competitive' THEN
      IF to_regclass('public.competitive_quiz_sessions') IS NOT NULL THEN
        EXECUTE '
          UPDATE public.competitive_quiz_sessions
          SET status = ''ended'', ended_at = COALESCE(ended_at, $2), question_end_time = $2
          WHERE event_id = $1
        '
        USING p_event_id, v_now;
      END IF;
    ELSIF v_event.type = 'treasure_hunt' THEN
      IF to_regclass('public.treasure_hunt_sessions') IS NOT NULL THEN
        EXECUTE '
          UPDATE public.treasure_hunt_sessions
          SET status = ''ended'', end_time = COALESCE(end_time, $2)
          WHERE event_id = $1
        '
        USING p_event_id, v_now;
      END IF;
    END IF;
  ELSE
    RETURN QUERY SELECT FALSE, v_event.status::TEXT, COALESCE(v_event.current_question_index, 0), v_event.question_end_at, v_event.state_version, 'Unsupported action';
    RETURN;
  END IF;

  SELECT *
  INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  RETURN QUERY SELECT TRUE, v_event.status::TEXT, COALESCE(v_event.current_question_index, 0), v_event.question_end_at, COALESCE(v_event.state_version, 0), 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_control_event(UUID, TEXT, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_control_event(UUID, TEXT, INTEGER, BOOLEAN) TO service_role;
