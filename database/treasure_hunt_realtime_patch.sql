-- =========================================================
-- EventArena: Realtime Treasure Hunt Patch
-- Run this in Supabase SQL editor.
-- =========================================================

-- 1) Global session state (single session per event)
CREATE TABLE IF NOT EXISTS public.treasure_hunt_sessions (
  event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  total_stages INTEGER NOT NULL CHECK (total_stages > 0),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'ended')),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  finish_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Stage pool: multiple variants per stage
CREATE TABLE IF NOT EXISTS public.treasure_hunt_stage_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL CHECK (stage > 0),
  question_id UUID NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  question_text TEXT,
  answer_text TEXT,
  media_url TEXT,
  hint_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, stage, question_id)
);

-- 3) Per-player runtime state
CREATE TABLE IF NOT EXISTS public.treasure_hunt_player_state (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_stage INTEGER NOT NULL DEFAULT 1 CHECK (current_stage > 0),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  penalty_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'finished', 'frozen')),
  last_question_id UUID REFERENCES public.question_bank(id) ON DELETE SET NULL,
  finished_at TIMESTAMPTZ,
  finish_rank INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_th_stage_questions_event_stage
  ON public.treasure_hunt_stage_questions (event_id, stage)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_th_player_state_event_status
  ON public.treasure_hunt_player_state (event_id, status);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.treasure_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_th_session_touch ON public.treasure_hunt_sessions;
CREATE TRIGGER trg_th_session_touch
BEFORE UPDATE ON public.treasure_hunt_sessions
FOR EACH ROW
EXECUTE FUNCTION public.treasure_touch_updated_at();

DROP TRIGGER IF EXISTS trg_th_player_touch ON public.treasure_hunt_player_state;
CREATE TRIGGER trg_th_player_touch
BEFORE UPDATE ON public.treasure_hunt_player_state
FOR EACH ROW
EXECUTE FUNCTION public.treasure_touch_updated_at();

-- Atomic finish handler to avoid race conditions
CREATE OR REPLACE FUNCTION public.treasure_record_finish(
  p_event_id UUID,
  p_user_id UUID,
  p_finished_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (finish_rank INTEGER, top3 JSONB, should_end BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.treasure_hunt_sessions%ROWTYPE;
  v_existing_rank INTEGER;
  v_next_rank INTEGER;
  v_order JSONB;
  v_already_in_order BOOLEAN;
BEGIN
  SELECT *
  INTO v_session
  FROM public.treasure_hunt_sessions
  WHERE event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Treasure session not configured for event %', p_event_id;
  END IF;

  SELECT finish_rank
  INTO v_existing_rank
  FROM public.treasure_hunt_player_state
  WHERE event_id = p_event_id AND user_id = p_user_id;

  IF v_existing_rank IS NOT NULL THEN
    RETURN QUERY
      SELECT v_existing_rank, v_session.finish_order, (v_session.status = 'ended');
    RETURN;
  END IF;

  v_order := COALESCE(v_session.finish_order, '[]'::jsonb);
  v_already_in_order := EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(v_order) AS t(uid)
    WHERE t.uid = p_user_id::text
  );

  IF v_already_in_order THEN
    v_next_rank := NULL;
  ELSE
    v_next_rank := jsonb_array_length(v_order) + 1;
    IF v_next_rank <= 3 THEN
      v_order := v_order || to_jsonb(p_user_id::text);
    ELSE
      v_next_rank := NULL;
    END IF;
  END IF;

  UPDATE public.treasure_hunt_player_state
  SET status = 'finished',
      finished_at = COALESCE(finished_at, p_finished_at),
      finish_rank = COALESCE(finish_rank, v_next_rank)
  WHERE event_id = p_event_id AND user_id = p_user_id;

  UPDATE public.treasure_hunt_sessions
  SET finish_order = v_order,
      status = CASE WHEN jsonb_array_length(v_order) >= 3 THEN 'ended' ELSE status END,
      end_time = CASE WHEN jsonb_array_length(v_order) >= 3 THEN COALESCE(end_time, p_finished_at) ELSE end_time END
  WHERE event_id = p_event_id;

  IF jsonb_array_length(v_order) >= 3 THEN
    UPDATE public.events
    SET status = 'ended', end_at = COALESCE(end_at, p_finished_at)
    WHERE id = p_event_id;

    UPDATE public.treasure_hunt_player_state
    SET status = CASE WHEN status = 'finished' THEN status ELSE 'frozen' END
    WHERE event_id = p_event_id;
  END IF;

  RETURN QUERY
    SELECT
      COALESCE(v_next_rank, v_existing_rank),
      v_order,
      (jsonb_array_length(v_order) >= 3);
END;
$$;

GRANT EXECUTE ON FUNCTION public.treasure_record_finish(UUID, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.treasure_record_finish(UUID, UUID, TIMESTAMPTZ) TO service_role;

-- Mirror admin event lifecycle into treasure session state
CREATE OR REPLACE FUNCTION public.treasure_sync_session_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_stages INTEGER;
  v_status TEXT;
BEGIN
  IF NEW.type <> 'treasure_hunt' THEN
    RETURN NEW;
  END IF;

  v_total_stages := COALESCE(
    (SELECT MAX(stage) FROM public.treasure_hunt_stage_questions WHERE event_id = NEW.id AND is_active = TRUE),
    (SELECT MAX(order_num) FROM public.event_questions WHERE event_id = NEW.id),
    1
  );

  v_status := CASE
    WHEN NEW.status = 'ended' THEN 'ended'
    WHEN NEW.status = 'live' THEN 'live'
    ELSE 'upcoming'
  END;

  INSERT INTO public.treasure_hunt_sessions (event_id, total_stages, status, start_time, end_time)
  VALUES (NEW.id, v_total_stages, v_status, NEW.start_at, CASE WHEN NEW.status = 'ended' THEN NEW.end_at ELSE NULL END)
  ON CONFLICT (event_id)
  DO UPDATE SET
    total_stages = GREATEST(public.treasure_hunt_sessions.total_stages, EXCLUDED.total_stages),
    status = EXCLUDED.status,
    start_time = CASE
      WHEN EXCLUDED.status = 'live' THEN COALESCE(public.treasure_hunt_sessions.start_time, EXCLUDED.start_time)
      ELSE public.treasure_hunt_sessions.start_time
    END,
    end_time = CASE
      WHEN EXCLUDED.status = 'ended' THEN COALESCE(public.treasure_hunt_sessions.end_time, EXCLUDED.end_time)
      ELSE public.treasure_hunt_sessions.end_time
    END;

  IF NEW.status = 'ended' THEN
    UPDATE public.treasure_hunt_player_state
    SET status = CASE WHEN status = 'finished' THEN status ELSE 'frozen' END
    WHERE event_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_treasure_sync_from_event ON public.events;
CREATE TRIGGER trg_treasure_sync_from_event
AFTER INSERT OR UPDATE OF status, start_at, end_at, type ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.treasure_sync_session_from_event();

-- RLS setup
ALTER TABLE public.treasure_hunt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasure_hunt_stage_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasure_hunt_player_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "TH sessions readable by all" ON public.treasure_hunt_sessions;
CREATE POLICY "TH sessions readable by all"
  ON public.treasure_hunt_sessions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "TH sessions writable by admins" ON public.treasure_hunt_sessions;
CREATE POLICY "TH sessions writable by admins"
  ON public.treasure_hunt_sessions FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "TH stage questions readable by all" ON public.treasure_hunt_stage_questions;
CREATE POLICY "TH stage questions readable by all"
  ON public.treasure_hunt_stage_questions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "TH stage questions writable by admins" ON public.treasure_hunt_stage_questions;
CREATE POLICY "TH stage questions writable by admins"
  ON public.treasure_hunt_stage_questions FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "TH player state readable own or admin" ON public.treasure_hunt_player_state;
CREATE POLICY "TH player state readable own or admin"
  ON public.treasure_hunt_player_state FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "TH player state writable own or admin" ON public.treasure_hunt_player_state;

DROP POLICY IF EXISTS "TH player state insert own or admin" ON public.treasure_hunt_player_state;
CREATE POLICY "TH player state insert own or admin"
  ON public.treasure_hunt_player_state FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "TH player state update own or admin" ON public.treasure_hunt_player_state;
CREATE POLICY "TH player state update own or admin"
  ON public.treasure_hunt_player_state FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "TH player state delete admin only" ON public.treasure_hunt_player_state;
CREATE POLICY "TH player state delete admin only"
  ON public.treasure_hunt_player_state FOR DELETE
  USING (public.is_admin());
