import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Action = 'bootstrap' | 'submit';

type StageQuestion = {
  question_id: string;
  question: string;
  hint: string | null;
  media_url: string | null;
  answer: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalize(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function toQuestionPayload(q: StageQuestion | null) {
  if (!q) return null;
  return {
    id: q.question_id,
    question: q.question,
    hint: q.hint,
    media: q.media_url,
  };
}

async function getStagePool(
  supabaseAdmin: ReturnType<typeof createClient>,
  eventId: string,
  stage: number,
): Promise<StageQuestion[]> {
  const { data: stageRows } = await supabaseAdmin
    .from('treasure_hunt_stage_questions')
    .select('question_id, question_text, answer_text, hint_text, media_url, question_bank(question, correct_answer, explanation)')
    .eq('event_id', eventId)
    .eq('stage', stage)
    .eq('is_active', true);

  if (stageRows && stageRows.length > 0) {
    return stageRows
      .map((row: any) => ({
        question_id: row.question_id,
        question: row.question_text || row.question_bank?.question || '',
        hint: row.hint_text || row.question_bank?.explanation || null,
        media_url: row.media_url || null,
        answer: row.answer_text || row.question_bank?.correct_answer || '',
      }))
      .filter((row: StageQuestion) => !!row.question && !!row.answer);
  }

  // Backward-compatible fallback: derive stage from event_questions.order_num
  const { data: fallbackRows } = await supabaseAdmin
    .from('event_questions')
    .select('question_id, question_bank(question, correct_answer, explanation)')
    .eq('event_id', eventId)
    .eq('order_num', stage);

  return (fallbackRows || [])
    .map((row: any) => ({
      question_id: row.question_id,
      question: row.question_bank?.question || '',
      hint: row.question_bank?.explanation || null,
      media_url: null,
      answer: row.question_bank?.correct_answer || '',
    }))
    .filter((row: StageQuestion) => !!row.question && !!row.answer);
}

async function getTotalStages(
  supabaseAdmin: ReturnType<typeof createClient>,
  eventId: string,
): Promise<number> {
  const { data: sessionRow } = await supabaseAdmin
    .from('treasure_hunt_sessions')
    .select('total_stages')
    .eq('event_id', eventId)
    .maybeSingle();

  if (sessionRow?.total_stages) return Number(sessionRow.total_stages);

  const { data: stageRows } = await supabaseAdmin
    .from('treasure_hunt_stage_questions')
    .select('stage')
    .eq('event_id', eventId)
    .eq('is_active', true)
    .order('stage', { ascending: false })
    .limit(1);

  const stageMax = Number(stageRows?.[0]?.stage || 0);
  if (stageMax > 0) return stageMax;

  const { data: fallbackRows } = await supabaseAdmin
    .from('event_questions')
    .select('order_num')
    .eq('event_id', eventId)
    .order('order_num', { ascending: false })
    .limit(1);

  return Number(fallbackRows?.[0]?.order_num || 0);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: authData, error: authError } = await supabaseUser.auth.getUser();
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

    if (!action || !eventId) {
      return new Response(JSON.stringify({ error: 'Missing action/eventId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: eventRow } = await supabaseAdmin
      .from('events')
      .select('id, type, status, start_at, end_at')
      .eq('id', eventId)
      .maybeSingle();

    if (!eventRow || eventRow.type !== 'treasure_hunt') {
      return new Response(JSON.stringify({ error: 'Treasure hunt event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (eventRow.status === 'upcoming') {
      return new Response(JSON.stringify({ error: 'Event not live yet', code: 'EVENT_NOT_LIVE' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const totalStages = await getTotalStages(supabaseAdmin, eventId);
    if (!totalStages || totalStages < 1) {
      return new Response(JSON.stringify({ error: 'No treasure stages configured', code: 'NO_STAGES' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: sessionRow } = await supabaseAdmin
      .from('treasure_hunt_sessions')
      .upsert({
        event_id: eventId,
        total_stages: totalStages,
        status: eventRow.status === 'ended' ? 'ended' : 'live',
        start_time: eventRow.start_at || new Date().toISOString(),
      }, { onConflict: 'event_id' })
      .select('*')
      .single();

    const { data: existingPlayer } = await supabaseAdmin
      .from('treasure_hunt_player_state')
      .select('event_id, user_id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingPlayer) {
      await supabaseAdmin
        .from('treasure_hunt_player_state')
        .insert({
          event_id: eventId,
          user_id: userId,
          current_stage: 1,
          attempts: 0,
          status: 'playing',
        });
    }

    const { data: player } = await supabaseAdmin
      .from('treasure_hunt_player_state')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    const { data: topPlayersRaw } = await supabaseAdmin
      .from('treasure_hunt_player_state')
      .select('user_id, finish_rank, finished_at, users(name)')
      .eq('event_id', eventId)
      .not('finish_rank', 'is', null)
      .order('finish_rank', { ascending: true })
      .limit(3);

    const topPlayers = (topPlayersRaw || []).map((row: any) => ({
      userId: row.user_id,
      name: row.users?.name || 'Player',
      rank: row.finish_rank,
      finishedAt: row.finished_at,
    }));

    if (action === 'bootstrap') {
      const now = Date.now();
      const penaltyMs = player?.penalty_until ? new Date(player.penalty_until).getTime() - now : 0;
      const activePenalty = Math.max(0, penaltyMs);

      let question: StageQuestion | null = null;
      if (player?.status === 'playing') {
        const pool = await getStagePool(supabaseAdmin, eventId, Number(player.current_stage));
        if (pool.length > 0) {
          if (player?.last_question_id) {
            question = pool.find((q) => q.question_id === player.last_question_id) || null;
          }
          if (!question) {
            question = pickRandom(pool);
            await supabaseAdmin
              .from('treasure_hunt_player_state')
              .update({ last_question_id: question.question_id })
              .eq('event_id', eventId)
              .eq('user_id', userId);
          }
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        session: {
          eventId,
          status: sessionRow?.status || 'live',
          startTime: sessionRow?.start_time,
          endTime: sessionRow?.end_time,
          totalStages,
          finishOrder: sessionRow?.finish_order || [],
          topPlayers,
        },
        player: {
          userId,
          currentStage: Number(player?.current_stage || 1),
          attempts: Number(player?.attempts || 0),
          penaltyUntil: player?.penalty_until || null,
          penaltySecondsLeft: Math.ceil(activePenalty / 1000),
          status: player?.status || 'playing',
          finishRank: player?.finish_rank || null,
        },
        question: toQuestionPayload(question),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action !== 'submit') {
      return new Response(JSON.stringify({ error: 'Unsupported action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!player) {
      return new Response(JSON.stringify({ error: 'Player state missing' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (sessionRow?.status === 'ended' || eventRow.status === 'ended') {
      return new Response(JSON.stringify({
        ok: true,
        result: 'ended',
        topPlayers,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (player.status !== 'playing') {
      return new Response(JSON.stringify({
        ok: true,
        result: player.status,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = Date.now();
    const penaltyMs = player.penalty_until ? new Date(player.penalty_until).getTime() - now : 0;
    if (penaltyMs > 0) {
      return new Response(JSON.stringify({
        ok: true,
        result: 'locked',
        penaltySecondsLeft: Math.ceil(penaltyMs / 1000),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const submittedAnswer = normalize(body?.answer);
    if (!submittedAnswer) {
      return new Response(JSON.stringify({ error: 'Answer is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentStage = Number(player.current_stage || 1);
    const pool = await getStagePool(supabaseAdmin, eventId, currentStage);
    if (!pool.length) {
      return new Response(JSON.stringify({ error: `No questions configured for stage ${currentStage}` }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let activeQuestion = pool.find((q) => q.question_id === player.last_question_id) || null;
    if (!activeQuestion) {
      activeQuestion = pickRandom(pool);
    }

    const isCorrect = normalize(activeQuestion.answer) === submittedAnswer;

    if (isCorrect) {
      const nextStage = currentStage + 1;

      if (nextStage > totalStages) {
        const { data: finishData, error: finishErr } = await supabaseAdmin.rpc('treasure_record_finish', {
          p_event_id: eventId,
          p_user_id: userId,
          p_finished_at: new Date().toISOString(),
        });

        if (finishErr) throw finishErr;

        const finishRow = Array.isArray(finishData) ? finishData[0] : finishData;
        return new Response(JSON.stringify({
          ok: true,
          result: 'finished',
          finishRank: finishRow?.finish_rank || null,
          shouldEnd: !!finishRow?.should_end,
          finishOrder: finishRow?.top3 || [],
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const nextPool = await getStagePool(supabaseAdmin, eventId, nextStage);
      const nextQuestion = nextPool.length ? pickRandom(nextPool) : null;

      await supabaseAdmin
        .from('treasure_hunt_player_state')
        .update({
          current_stage: nextStage,
          attempts: 0,
          penalty_until: null,
          last_question_id: nextQuestion?.question_id || null,
        })
        .eq('event_id', eventId)
        .eq('user_id', userId);

      return new Response(JSON.stringify({
        ok: true,
        result: 'correct',
        player: {
          currentStage: nextStage,
          attempts: 0,
          penaltySecondsLeft: 0,
          status: 'playing',
        },
        question: toQuestionPayload(nextQuestion),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nextAttempts = Number(player.attempts || 0) + 1;
    const penaltySeconds = nextAttempts * 20;
    const penaltyUntil = new Date(Date.now() + penaltySeconds * 1000).toISOString();

    const alternatives = pool.filter((q) => q.question_id !== activeQuestion.question_id);
    const rotated = alternatives.length ? pickRandom(alternatives) : activeQuestion;

    await supabaseAdmin
      .from('treasure_hunt_player_state')
      .update({
        attempts: nextAttempts,
        penalty_until: penaltyUntil,
        last_question_id: rotated.question_id,
      })
      .eq('event_id', eventId)
      .eq('user_id', userId);

    return new Response(JSON.stringify({
      ok: true,
      result: 'wrong',
      penaltySeconds,
      penaltyUntil,
      attempts: nextAttempts,
      message: 'Wrong path. Wait for cooldown before the next clue appears.',
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
