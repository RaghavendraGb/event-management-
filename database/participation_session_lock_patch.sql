-- =========================================================
-- Participation session lock patch
-- Prevents multi-tab abuse by tracking a server-owned live session per user/event.
-- =========================================================

ALTER TABLE public.participation
  ADD COLUMN IF NOT EXISTS active_session_id UUID;

ALTER TABLE public.participation
  ADD COLUMN IF NOT EXISTS active_session_started_at TIMESTAMPTZ;

ALTER TABLE public.participation
  ADD COLUMN IF NOT EXISTS active_session_heartbeat_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_participation_active_session
  ON public.participation (event_id, user_id, active_session_id);

CREATE OR REPLACE FUNCTION public.claim_participation_session(
  p_event_id UUID,
  p_user_id UUID,
  p_session_id UUID
)
RETURNS TABLE (claimed BOOLEAN, active_session_id UUID, locked BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_part public.participation%ROWTYPE;
  v_stale_cutoff TIMESTAMPTZ := NOW() - INTERVAL '30 seconds';
BEGIN
  SELECT *
  INTO v_part
  FROM public.participation
  WHERE event_id = p_event_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participation row missing for event % / user %', p_event_id, p_user_id;
  END IF;

  IF v_part.active_session_id IS NOT NULL
     AND v_part.active_session_id <> p_session_id
     AND COALESCE(v_part.active_session_heartbeat_at, v_part.registered_at) > v_stale_cutoff THEN
    RETURN QUERY SELECT FALSE, v_part.active_session_id, TRUE;
    RETURN;
  END IF;

  UPDATE public.participation
  SET active_session_id = p_session_id,
      active_session_started_at = COALESCE(active_session_started_at, NOW()),
      active_session_heartbeat_at = NOW()
  WHERE event_id = p_event_id
    AND user_id = p_user_id;

  RETURN QUERY SELECT TRUE, p_session_id, FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_participation_session(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_participation_session(UUID, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.heartbeat_participation_session(
  p_event_id UUID,
  p_user_id UUID,
  p_session_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.participation
  SET active_session_heartbeat_at = NOW()
  WHERE event_id = p_event_id
    AND user_id = p_user_id
    AND active_session_id = p_session_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.heartbeat_participation_session(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_participation_session(UUID, UUID, UUID) TO service_role;
