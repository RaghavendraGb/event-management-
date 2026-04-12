import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

interface Env {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

async function initMatch(supabase: any, body: any) {
  const { eventId, player1Id, player2Id } = body

  if (!eventId || !player1Id || !player2Id) {
    throw new Error('Missing eventId/player1Id/player2Id for initMatch')
  }

  const { data, error } = await supabase.rpc('youandme_init_match', {
    p_event_id: eventId,
    p_player1_id: player1Id,
    p_player2_id: player2Id,
  })

  if (error) throw error

  if (!data?.success || !data?.session_id) {
    throw new Error(data?.error || 'Unable to start You & Me match. Ensure You & Me DB patch is applied and event has valid assigned questions.')
  }

  return {
    success: true,
    sessionId: data.session_id,
    questionCount: data.question_count,
  }
}

async function bootstrap(supabase: any, body: any) {
  const { sessionId, playerId } = body

  if (!sessionId || !playerId) {
    throw new Error('Missing sessionId/playerId for bootstrap')
  }

  // Get session state
  const { data: session, error: sessionError } = await supabase
    .from('youandme_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError) throw sessionError

  // Get player state
  const { data: playerState, error: playerError } = await supabase
    .from('youandme_player_state')
    .select('*')
    .eq('session_id', sessionId)
    .eq('player_id', playerId)
    .single()

  if (playerError) throw playerError

  // Get current question (if in answering phase)
  let currentQuestion = null
  if (playerState.status === 'answering') {
    const { data: selection } = await supabase
      .from('youandme_selections')
      .select(`
        question_id,
        question_bank:question_bank(
          id,
          question,
          options,
          difficulty,
          correct_answer
        )
      `)
      .eq('session_id', sessionId)
      .eq('for_player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (selection?.question_bank) {
      currentQuestion = {
        id: selection.question_id,
        text: selection.question_bank.question || selection.question_bank.question_text,
        options: selection.question_bank.options,
        difficulty: selection.question_bank.difficulty,
      }
    }
  }

  // Get available questions for selection (if in selecting phase)
  let availableQuestions = []
  if (playerState.status === 'selecting') {
    const { data: available } = await supabase
      .rpc('youandme_get_available_questions', { p_session_id: sessionId })

    availableQuestions = available || []
  }

  // Get leaderboard
  const { data: leaderboard } = await supabase
    .from('youandme_player_state')
    .select(`
      player_id,
      correct_answers,
      total_score,
      users:player_id(id, name, avatar)
    `)
    .eq('session_id', sessionId)
    .order('total_score', { ascending: false })

  const opponent =
    session.player1_id === playerId ? session.player2_id : session.player1_id
  const opponentState = await supabase
    .from('youandme_player_state')
    .select('*')
    .eq('session_id', sessionId)
    .eq('player_id', opponent)
    .single()

  return {
    success: true,
    session: {
      id: session.id,
      status: session.status,
      phase: session.current_phase,
      player1Score: session.player1_score,
      player2Score: session.player2_score,
      questionsUsed: session.questions_used,
      totalQuestions: session.question_pool_size,
      winnerId: session.winner_id,
    },
    playerState: {
      status: playerState.status,
      correctAnswers: playerState.correct_answers,
      totalScore: playerState.total_score,
      selectionCount: playerState.selection_count,
      answerCount: playerState.answer_count,
    },
    opponent: {
      id: opponent,
      status: opponentState.data?.status,
      correctAnswers: opponentState.data?.correct_answers,
      totalScore: opponentState.data?.total_score,
    },
    currentQuestion,
    availableQuestions,
    leaderboard: leaderboard || [],
  }
}

async function selectQuestion(supabase: any, body: any) {
  const { sessionId, questionId, playerId } = body

  if (!sessionId || !questionId || !playerId) {
    throw new Error('Missing sessionId/questionId/playerId for selectQuestion')
  }

  // Validate selection time (30 sec timeout handled client-side, but check server-side)
  const result = await supabase.rpc('youandme_select_question', {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_selected_by_id: playerId,
  })

  if (result.error) throw result.error

  if (!result?.data?.success) {
    throw new Error(result?.data?.error || 'Question selection failed')
  }

  return {
    success: true,
    questionId: result.data.question_id,
    forPlayerId: result.data.for_player_id,
    selectedAt: result.data.selected_at,
  }
}

async function submitAnswer(supabase: any, body: any) {
  const { sessionId, phase, questionId, playerId, answer, isCorrect, timeMs } =
    body

  if (!sessionId || !phase || !questionId || !playerId) {
    throw new Error('Missing sessionId/phase/questionId/playerId for submitAnswer')
  }

  // Record answer
  const result = await supabase.rpc('youandme_submit_answer', {
    p_session_id: sessionId,
    p_phase: phase,
    p_question_id: questionId,
    p_player_id: playerId,
    p_answer: answer,
    p_is_correct: isCorrect,
    p_time_ms: timeMs,
  })

  if (result.error) throw result.error

  if (!result?.data?.success) {
    throw new Error(result?.data?.error || 'Answer submission failed')
  }

  // Check if all players have answered this round
  const { data: questionsUsed } = await supabase
    .from('youandme_answers')
    .select('question_id', { count: 'exact' })
    .eq('session_id', sessionId)
    .eq('phase', phase)

  const { data: session } = await supabase
    .from('youandme_sessions')
    .select('question_pool_size')
    .eq('id', sessionId)
    .single()

  const phaseComplete =
    questionsUsed.length >= session.question_pool_size * (phase === 'answering_1' ? 1 : 1)

  return {
    success: true,
    isCorrect,
    phaseComplete: result.data.phase_complete,
  }
}

async function heartbeat(supabase: any, body: any) {
  const { sessionId, playerId } = body

  if (!sessionId || !playerId) {
    throw new Error('Missing sessionId/playerId for heartbeat')
  }

  // Update last heartbeat
  await supabase
    .from('youandme_player_state')
    .update({ last_heartbeat: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('player_id', playerId)

  // Return current state (same as bootstrap)
  return bootstrap(supabase, body)
}

async function evaluateScores(supabase: any, body: any) {
  const { sessionId } = body

  if (!sessionId) {
    throw new Error('Missing sessionId for evaluateScores')
  }

  const result = await supabase.rpc('youandme_evaluate_scores', {
    p_session_id: sessionId,
  })

  if (result.error) throw result.error

  return {
    success: true,
    player1Score: result.data.player1_score,
    player2Score: result.data.player2_score,
    isTie: result.data.is_tie,
    winnerId: result.data.winner_id,
  }
}

async function getTieBreakQuestions(supabase: any, body: any) {
  const { sessionId, round } = body
  if (!sessionId) {
    throw new Error('Missing sessionId for getTieBreakQuestions')
  }
  const questionCount = round === 1 ? 3 : round === 2 ? 1 : 1

  const { data: session, error: sessionErr } = await supabase
    .from('youandme_sessions')
    .select('event_id')
    .eq('id', sessionId)
    .single()

  if (sessionErr) throw sessionErr

  const { data: selectedRows, error: selectedErr } = await supabase
    .from('youandme_selections')
    .select('question_id')
    .eq('session_id', sessionId)

  if (selectedErr) throw selectedErr

  const selectedIds = new Set((selectedRows || []).map((row: any) => row.question_id))

  const { data: mapped, error: mappedErr } = await supabase
    .from('event_questions')
    .select(`
      question_id,
      question_bank:question_id(
        id,
        question,
        options,
        difficulty
      )
    `)
    .eq('event_id', session.event_id)

  if (mappedErr) throw mappedErr

  const candidates = (mapped || [])
    .map((row: any) => row.question_bank)
    .filter((q: any) => q && !selectedIds.has(q.id))

  const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, questionCount)

  const normalized = shuffled.map((q: any) => ({
    id: q.id,
    text: q.question || q.question_text,
    options: q.options,
    difficulty: q.difficulty,
  }))

  return {
    success: true,
    round,
    questions: normalized,
  }
}

async function handleRequest(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await request.json()
    const action = body.action

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    let result: any

    switch (action) {
      case 'initMatch':
        result = await initMatch(supabase, body)
        break
      case 'bootstrap':
        result = await bootstrap(supabase, body)
        break
      case 'selectQuestion':
        result = await selectQuestion(supabase, body)
        break
      case 'submitAnswer':
        result = await submitAnswer(supabase, body)
        break
      case 'heartbeat':
        result = await heartbeat(supabase, body)
        break
      case 'evaluateScores':
        result = await evaluateScores(supabase, body)
        break
      case 'getTieBreakQuestions':
        result = await getTieBreakQuestions(supabase, body)
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: corsHeaders }
        )
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders,
    })
  } catch (error: any) {
    console.error('You & Me Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error?.details || null,
        hint: error?.hint || null,
        code: error?.code || null,
      }),
      { status: 500, headers: corsHeaders }
    )
  }
}

Deno.serve(handleRequest)
