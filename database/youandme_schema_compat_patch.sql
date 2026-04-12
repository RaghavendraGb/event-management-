-- =========================================================
-- You & Me schema compatibility patch
-- Safe to run multiple times.
-- Aligns You & Me functions to current schema:
--   question_bank(question, options, difficulty)
--   event_questions(event_id, question_id)
-- =========================================================

CREATE OR REPLACE FUNCTION public.youandme_init_match(
  p_event_id UUID,
  p_player1_id UUID,
  p_player2_id UUID
) RETURNS jsonb AS $$
DECLARE
  v_session_id UUID;
  v_question_count INTEGER;
BEGIN
  -- Count assigned questions for this event from event_questions.
  SELECT COUNT(*)
  INTO v_question_count
  FROM public.event_questions eq
  WHERE eq.event_id = p_event_id;

  IF v_question_count < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough assigned questions for this event');
  END IF;

  -- Create session.
  INSERT INTO public.youandme_sessions (
    event_id,
    player1_id,
    player2_id,
    question_pool_size,
    status,
    current_phase
  ) VALUES (
    p_event_id,
    p_player1_id,
    p_player2_id,
    v_question_count,
    'selection',
    'selection_1'
  )
  RETURNING id INTO v_session_id;

  -- Initialize player states.
  INSERT INTO public.youandme_player_state (session_id, player_id, status)
  VALUES
    (v_session_id, p_player1_id, 'selecting'),
    (v_session_id, p_player2_id, 'waiting');

  -- Create initial round.
  INSERT INTO public.youandme_rounds (session_id, phase, round_number, total_questions, started_at)
  VALUES (v_session_id, 'selection_1', 1, v_question_count, NOW());

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'question_count', v_question_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.youandme_get_available_questions(
  p_session_id UUID
) RETURNS SETOF jsonb AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT ys.event_id INTO v_event_id
  FROM public.youandme_sessions ys
  WHERE ys.id = p_session_id;

  RETURN QUERY
  SELECT jsonb_build_object(
    'id', qb.id,
    'text', qb.question,
    'options', qb.options,
    'difficulty', qb.difficulty
  )
  FROM public.event_questions eq
  JOIN public.question_bank qb ON qb.id = eq.question_id
  WHERE eq.event_id = v_event_id
    AND qb.id NOT IN (
      SELECT ys.question_id
      FROM public.youandme_selections ys
      WHERE ys.session_id = p_session_id
    )
  ORDER BY eq.order_num ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
