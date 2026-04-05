import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { code, event_id, problem_id, user_id } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all test cases including hidden (admin client bypasses RLS)
    const { data: testCases } = await supabaseAdmin
      .from('coding_test_cases')
      .select('*')
      .eq('problem_id', problem_id)
      .order('order_num');

    const { data: problem } = await supabaseAdmin
      .from('coding_problems')
      .select('time_limit_ms, points_per_testcase')
      .eq('id', problem_id)
      .single();

    const timeLimit = problem?.time_limit_ms ?? 3000;
    const pointsEach = problem?.points_per_testcase ?? 2;

    // Run all test cases through Piston sequentially
    const results = [];
    let compilationError = null;

    for (const tc of (testCases ?? [])) {
      if (compilationError) {
        results.push({ test_case_id: tc.id, passed: false, is_hidden: tc.is_hidden, error: 'Compile error' });
        continue;
      }

      try {
        // Sequential gap to avoid Piston rate limits
        if (results.length > 0) await new Promise(r => setTimeout(r, 200));

        const res = await fetch('https://emkc.org/api/v2/piston/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: "cpp",
            version: "10.2.0",
            files: [{ name: "main.cpp", content: code }],
            stdin: tc.input
          }),
        });

        if (!res.ok) {
           results.push({ test_case_id: tc.id, passed: false, is_hidden: tc.is_hidden, error: 'Compiler service unavailable' });
           continue;
        }

        const data = await res.json();
        
        // Handle compilation error
        if (data.compile && data.compile.code !== 0) {
          compilationError = data.compile.stderr || data.compile.output;
          results.push({ test_case_id: tc.id, passed: false, is_hidden: tc.is_hidden, error: 'Compile error' });
          continue;
        }

        const actualOutput = (data.run?.stdout ?? '').trim();
        const expectedOutput = tc.expected_output.trim();
        const passed = actualOutput === expectedOutput && data.run?.code === 0;
        const runtime_ms = 0; // Piston doesn't return precise runtime

        // For hidden test cases: never return input or expected_output
        results.push({
          test_case_id: tc.id,
          passed,
          is_hidden: tc.is_hidden,
          runtime_ms,
          ...(tc.is_hidden ? {} : { actual_output: actualOutput }),
        });
      } catch (err) {
        results.push({ test_case_id: tc.id, passed: false, is_hidden: tc.is_hidden, error: 'Execution error' });
      }
    }

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    const score = passedCount * pointsEach;

    // Save submission
    await supabaseAdmin.from('coding_submissions').insert({
      event_id, user_id, problem_id, code,
      test_results: results,
      passed_count: passedCount,
      total_count: totalCount,
      score,
    });

    // Update participation score (only if this submission is better)
    const { data: existing } = await supabaseAdmin
      .from('participation')
      .select('score')
      .eq('event_id', event_id)
      .eq('user_id', user_id)
      .single();

    if (!existing || score > (existing.score ?? 0)) {
      await supabaseAdmin.from('participation')
        .update({ score, status: 'submitted' })
        .eq('event_id', event_id)
        .eq('user_id', user_id);
    }

    return new Response(JSON.stringify({ results, passedCount, totalCount, score }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
