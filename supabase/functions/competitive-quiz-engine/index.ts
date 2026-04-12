import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Action = 'bootstrap' | 'submit' | 'heartbeat' | 'violation' | 'control';

const requestThrottle = new Map<string, number>();

type SessionRow = {
  event_id: string;
  status: 'upcoming' | 'live' | 'paused' | 'ended';
  total_questions: number;
  current_question_index: number;
  question_duration_seconds: number;
  scoring_factor: number;
  violation_mode: 'strict' | 'penalty' | 'disqualify';
  question_start_time: string | null;
  question_end_time: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalize(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function clampScore(score: number): number {
  return Math.max(0, Math.round(score));
}

async function ensurePlayerState(
  admin: ReturnType<typeof createClient>,
  eventId: string,
  userId: string,
  currentQuestionIndex: number,
) {
  const { data: existing } = await admin
    .from('competitive_quiz_player_state')
    .select('event_id, user_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) {
    await admin.from('competitive_quiz_player_state').insert({
      event_id: eventId,
      user_id: userId,
      current_question_index: currentQuestionIndex,
      status: 'playing',
    });
  }
}

async function getQuestionByIndex(
  admin: ReturnType<typeof createClient>,
  eventId: string,
  index: number,
) {
  const { data } = await admin
    .from('event_questions')
    .select('id, question_id, order_num, question_bank(question, options, correct_answer, explanation)')
    .eq('event_id', eventId)
    .order('order_num', { ascending: true })
    .order('created_at', { ascending: true })
    .range(index, index)
    .maybeSingle();

  if (!data) return null;

  const options = Array.isArray(data.question_bank?.options)
    ? data.question_bank.options
    : [];

  return {
    eventQuestionId: data.id,
    questionId: data.question_id,
    orderNum: data.order_num,
    question: data.question_bank?.question || '',
    options,
    correctAnswer: data.question_bank?.correct_answer || '',
    explanation: data.question_bank?.explanation || null,
  };
}

async function getEventQuestionCount(
  admin: ReturnType<typeof createClient>,
  eventId: string,
) {
  const { count } = await admin
    .from('event_questions')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  return Number(count || 0);
}

async function getTopPlayers(admin: ReturnType<typeof createClient>, eventId: string) {
  const { data } = await admin
    .from('competitive_quiz_player_state')
    .select('user_id, total_score, status, users(name)')
    .eq('event_id', eventId)
    .neq('status', 'disqualified')
    .order('total_score', { ascending: false })
    .limit(5);

  return (data || []).map((row: any, idx: number) => ({
    rank: idx + 1,
    userId: row.user_id,
    name: row.users?.name || 'Player',
    score: Number(row.total_score || 0),
  }));
}

async function getUserRank(admin: ReturnType<typeof createClient>, eventId: string, userId: string) {
  const { data } = await admin
    .from('competitive_quiz_player_state')
    .select('user_id, total_score, status')
    .eq('event_id', eventId)
    .neq('status', 'disqualified')
    .order('total_score', { ascending: false });

  const idx = (data || []).findIndex((row: any) => row.user_id === userId);
  return idx >= 0 ? idx + 1 : null;
}

async function assertActiveSessionOwnership(
  admin: ReturnType<typeof createClient>,
  eventId: string,
  userId: string,
  sessionToken: string,
) {
  if (!sessionToken) {
    return { ok: false, error: 'Missing session token' };
  }

  const { data: participation } = await admin
    .from('participation')
    .select('active_session_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!participation || participation.active_session_id !== sessionToken) {
    return { ok: false, error: 'This tab no longer owns the active session.' };
  }

  return { ok: true };
}

async function syncCompetitiveScoresToParticipation(
  admin: ReturnType<typeof createClient>,
  eventId: string,
) {
  const { data: players } = await admin
    .from('competitive_quiz_player_state')
    .select('user_id, total_score, status')
    .eq('event_id', eventId);

  if (!players || players.length === 0) return;

  for (const p of players) {
    const nextStatus = p.status === 'disqualified' ? 'completed' : 'submitted';
    await admin
      .from('participation')
      .update({
        score: Number(p.total_score || 0),
        status: nextStatus,
      })
      .eq('event_id', eventId)
      .eq('user_id', p.user_id);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization') || '';
    const anon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: authData, error: authError } = await anon.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authData.user.id;
    const body = await req.json();

    const action = body?.action as Action;
    const eventId = body?.eventId as string;
    const sessionToken = body?.sessionToken as string;
    if (!action || !eventId) {
      return new Response(JSON.stringify({ error: 'Missing action/eventId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: eventRow } = await admin
      .from('events')
      .select('id, type, status, quiz_mode')
      .eq('id', eventId)
      .maybeSingle();

    if (!eventRow || eventRow.type !== 'quiz' || eventRow.quiz_mode !== 'competitive') {
      return new Response(JSON.stringify({ error: 'Competitive quiz event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const throttleKey = `${userId}:${eventId}:${action}`;
    const now = Date.now();
    for (const [key, timestamp] of requestThrottle.entries()) {
      if (now - timestamp > 3000) requestThrottle.delete(key);
    }
    const lastCall = requestThrottle.get(throttleKey) || 0;
    if (now - lastCall < 300) {
      return new Response(JSON.stringify({ ok: true, throttled: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    requestThrottle.set(throttleKey, now);

    const isAdmin = profile?.role === 'admin';

    const advanceIfNeeded = async () => {
      const { data: adv, error: advErr } = await admin.rpc('competitive_quiz_advance', {
        p_event_id: eventId,
        p_force: false,
      });
      if (advErr) throw advErr;
      return Array.isArray(adv) ? adv[0] : adv;
    };

    if (action === 'control') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin only action' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const command = String(body?.command || '');

      const { data: currentSession } = await admin
        .from('competitive_quiz_sessions')
        .select('*')
        .eq('event_id', eventId)
        .single();

      if (!currentSession) {
        return new Response(JSON.stringify({ error: 'Session missing' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (command === 'pause') {
        await admin
          .from('competitive_quiz_sessions')
          .update({ status: 'paused' })
          .eq('event_id', eventId);
      } else if (command === 'resume') {
        const nowIso = new Date().toISOString();
        const endIso = new Date(Date.now() + Number(currentSession.question_duration_seconds || 15) * 1000).toISOString();
        await admin
          .from('competitive_quiz_sessions')
          .update({ status: 'live', question_start_time: nowIso, question_end_time: endIso })
          .eq('event_id', eventId);
      } else if (command === 'end') {
        await admin
          .from('competitive_quiz_sessions')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('event_id', eventId);
        await admin.from('events').update({ status: 'ended' }).eq('id', eventId);
        await syncCompetitiveScoresToParticipation(admin, eventId);
      } else {
        return new Response(JSON.stringify({ error: 'Unknown control command' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sessionOwnership = await assertActiveSessionOwnership(admin, eventId, userId, sessionToken);
    if (!sessionOwnership.ok) {
      return new Response(JSON.stringify({ error: sessionOwnership.error }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let { data: session } = await admin
      .from('competitive_quiz_sessions')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (!session) {
      return new Response(JSON.stringify({ error: 'Competitive session not initialized' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const actualQuestionCount = await getEventQuestionCount(admin, eventId);

    if (session.total_questions !== actualQuestionCount) {
      const { data: patchedSession } = await admin
        .from('competitive_quiz_sessions')
        .update({
          total_questions: actualQuestionCount,
          current_question_index: Math.min(
            Number(session.current_question_index || 0),
            Math.max(actualQuestionCount - 1, 0),
          ),
        })
        .eq('event_id', eventId)
        .select('*')
        .single();

      if (patchedSession) {
        session = patchedSession;
      }
    }

    if (actualQuestionCount > 0) {
      // Ensure timer progression is globally advanced when needed
      await advanceIfNeeded();

      const { data: refreshedSession } = await admin
        .from('competitive_quiz_sessions')
        .select('*')
        .eq('event_id', eventId)
        .single();

      if (refreshedSession) {
        session = refreshedSession;
      }
    }

    if (session.status === 'ended') {
      await syncCompetitiveScoresToParticipation(admin, eventId);
    }

    await ensurePlayerState(admin, eventId, userId, Number(session.current_question_index || 0));

    const { data: player } = await admin
      .from('competitive_quiz_player_state')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    const question = session.status === 'live'
      ? await getQuestionByIndex(admin, eventId, Number(session.current_question_index || 0))
      : null;

    let answeredCurrent = false;
    if (question) {
      const { data: answeredRow } = await admin
        .from('competitive_quiz_answers')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .eq('question_id', question.questionId)
        .maybeSingle();
      answeredCurrent = !!answeredRow;
    }

    const top5 = await getTopPlayers(admin, eventId);
    const myRank = await getUserRank(admin, eventId, userId);

    if (action === 'bootstrap' || action === 'heartbeat') {
      return new Response(JSON.stringify({
        ok: true,
        session: {
          status: session.status,
          totalQuestions: Number(session.total_questions || 0),
          currentQuestionIndex: Number(session.current_question_index || 0),
          questionEndTime: session.question_end_time,
          questionDurationSeconds: Number(session.question_duration_seconds || 15),
          violationMode: session.violation_mode,
        },
        player: {
          status: player?.status || 'playing',
          score: Number(player?.total_score || 0),
          lastPoints: Number(player?.last_points || 0),
          lastAnswerCorrect: player?.last_answer_correct ?? null,
          violations: Number(player?.violations || 0),
          rank: myRank,
          answeredCurrent,
          isAdmin,
        },
        question: question
          ? {
              id: question.questionId,
              index: Number(session.current_question_index || 0),
              text: question.question,
              options: question.options,
            }
          : null,
        leaderboard: top5,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'violation') {
      if (!player || player.status !== 'playing') {
        return new Response(JSON.stringify({ ok: true, result: 'ignored' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const nextViolations = Number(player.violations || 0) + 1;
      await admin
        .from('competitive_quiz_player_state')
        .update({ violations: nextViolations })
        .eq('event_id', eventId)
        .eq('user_id', userId);

      const mode = session.violation_mode || 'strict';
      if (mode === 'disqualify') {
        await admin
          .from('competitive_quiz_player_state')
          .update({ status: 'disqualified' })
          .eq('event_id', eventId)
          .eq('user_id', userId);

        return new Response(JSON.stringify({ ok: true, result: 'disqualified' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (question) {
        const { data: existing } = await admin
          .from('competitive_quiz_answers')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .eq('question_id', question.questionId)
          .maybeSingle();

        if (!existing) {
          await admin.from('competitive_quiz_answers').insert({
            event_id: eventId,
            user_id: userId,
            question_id: question.questionId,
            question_index: Number(session.current_question_index || 0),
            selected_answer: null,
            is_correct: false,
            violated: true,
            time_taken_ms: null,
            points: 0,
          });

          await admin
            .from('competitive_quiz_player_state')
            .update({ last_points: 0, last_answer_correct: false, last_answer_at: new Date().toISOString() })
            .eq('event_id', eventId)
            .eq('user_id', userId);
        }
      }

      return new Response(JSON.stringify({ ok: true, result: mode === 'strict' ? 'strict_marked' : 'penalty_marked' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action !== 'submit') {
      return new Response(JSON.stringify({ error: 'Unsupported action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!player || player.status !== 'playing') {
      return new Response(JSON.stringify({ ok: true, result: 'not-playing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (session.status !== 'live') {
      return new Response(JSON.stringify({ ok: true, result: 'not-live' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!question) {
      return new Response(JSON.stringify({ ok: true, result: 'no-question' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const answer = normalize(body?.answer);
    if (!answer) {
      return new Response(JSON.stringify({ error: 'Answer required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existingAnswer } = await admin
      .from('competitive_quiz_answers')
      .select('id, points, is_correct')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('question_id', question.questionId)
      .maybeSingle();

    if (existingAnswer) {
      return new Response(JSON.stringify({
        ok: true,
        result: 'already-answered',
        isCorrect: existingAnswer.is_correct,
        points: Number(existingAnswer.points || 0),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const endMs = session.question_end_time ? new Date(session.question_end_time).getTime() : Date.now();
    const startMs = session.question_start_time ? new Date(session.question_start_time).getTime() : Date.now();
    const nowMs = Date.now();
    const expired = nowMs > endMs;

    const isCorrect = !expired && answer === normalize(question.correctAnswer);
    const timeTakenMs = Math.max(0, Math.min(nowMs - startMs, endMs - startMs));
    const timeTakenSec = timeTakenMs / 1000;
    const points = isCorrect
      ? clampScore(1000 - (timeTakenSec * Number(session.scoring_factor || 25)))
      : 0;

    await admin.from('competitive_quiz_answers').insert({
      event_id: eventId,
      user_id: userId,
      question_id: question.questionId,
      question_index: Number(session.current_question_index || 0),
      selected_answer: answer,
      is_correct: isCorrect,
      violated: false,
      time_taken_ms: timeTakenMs,
      points,
    });

    await admin
      .from('competitive_quiz_player_state')
      .update({
        total_score: Number(player.total_score || 0) + points,
        last_points: points,
        last_answer_correct: isCorrect,
        last_answer_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
      .eq('user_id', userId);

    const refreshedTop5 = await getTopPlayers(admin, eventId);
    const refreshedRank = await getUserRank(admin, eventId, userId);

    return new Response(JSON.stringify({
      ok: true,
      result: isCorrect ? 'correct' : 'wrong',
      isCorrect,
      points,
      explanation: question.explanation,
      rank: refreshedRank,
      leaderboard: refreshedTop5,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
