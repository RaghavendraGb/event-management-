import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ControllerAction = 'start' | 'pause' | 'resume' | 'end' | 'force_end';

const requestThrottle = new Map<string, number>();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    const body = await req.json();
    const action = String(body?.action || '').toLowerCase() as ControllerAction;
    const eventId = String(body?.eventId || '');
    const questionDurationSeconds = Number(body?.questionDurationSeconds || 15);
    const force = Boolean(body?.force || false);
    const throttleKey = `${authData.user.id}:${eventId}:${action}`;
    const now = Date.now();
    for (const [key, timestamp] of requestThrottle.entries()) {
      if (now - timestamp > 3000) requestThrottle.delete(key);
    }
    const lastCall = requestThrottle.get(throttleKey) || 0;
    if (now - lastCall < 300) {
      return new Response(JSON.stringify({ ok: true, throttled: true, message: 'Ignored rapid duplicate control request' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    requestThrottle.set(throttleKey, now);

    if (!eventId || !action) {
      return new Response(JSON.stringify({ error: 'Missing action/eventId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supportedActions: ControllerAction[] = ['start', 'pause', 'resume', 'end', 'force_end'];
    if (!supportedActions.includes(action)) {
      return new Response(JSON.stringify({ error: 'Unsupported action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabaseUser.rpc('admin_control_event', {
      p_event_id: eventId,
      p_action: action,
      p_question_duration_seconds: questionDurationSeconds,
      p_force: force,
    });

    if (error) {
      const statusCode = /admin/i.test(error.message || '') ? 403 : 409;
      return new Response(JSON.stringify({ error: error.message || 'Controller action failed' }), {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.ok) {
      return new Response(JSON.stringify({
        ok: false,
        message: row?.message || 'Controller action rejected',
        status: row?.status || null,
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      action,
      event: {
        id: eventId,
        status: row.status,
        currentQuestionIndex: Number(row.current_question_index || 0),
        questionEndAt: row.question_end_at || null,
        stateVersion: Number(row.state_version || 0),
      },
      message: row.message || 'ok',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unexpected controller failure' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
