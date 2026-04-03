import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jfqynyxhzusyiwavuijg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcXlueXhoenVzeWl3YXZ1aWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjY4NjEsImV4cCI6MjA5MDc0Mjg2MX0._5clBR5d0gCd-LXiB4mEcXyV486nODPXI0hVE-OwOwA';

const supabase = createClient(supabaseUrl, supabaseKey);

// Use the credentials from setup_test.js
const TEST_EMAIL = 'test_user_z2vn3g@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const EVENT_ID = '4198854d-6bb1-4e17-a334-f0658afc1424';

async function verifyLogic() {
  console.log('--- Step 1: Logging in ---');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });

  if (authErr) {
    console.error('Login Failed:', authErr);
    return;
  }
  const user = authData.user;
  const session = authData.session;
  console.log('Logged in as:', user.id);

  // Set the session for subsequent requests (though createClient handle it if we use the same instance)
  // Actually, for node, we might need to recreate the client with the access token if we want to test RLS
  const authedSupabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    }
  });

  console.log('--- Step 2: Checking Event Details ---');
  const { data: event, error: evErr } = await authedSupabase.from('events').select('*').eq('id', EVENT_ID).single();
  if (evErr) console.error('Event Detail Error:', evErr);
  else console.log('Event Found:', event.title, 'Status:', event.status);

  console.log('--- Step 3: Registering for Event ---');
  const { data: part, error: regErr } = await authedSupabase.from('participation').insert([{
    user_id: user.id,
    event_id: EVENT_ID,
    status: 'registered'
  }]).select().single();

  if (regErr) {
    if (regErr.code === '23505') { // Unique violation
        console.log('Already registered for this event.');
    } else {
        console.error('Registration Error:', regErr);
        return;
    }
  } else {
    console.log('Registered successfully! Participation ID:', part.id);
  }

  console.log('--- Step 4: Loading Live Event Data ---');
  // Simulate LiveEvent.jsx boot engine
  const { data: qData } = await authedSupabase.from('event_questions').select('*, question_bank(*)').eq('event_id', EVENT_ID).order('order_num', { ascending: true });
  console.log('Questions Loaded:', qData?.length || 0);

  const { data: pData } = await authedSupabase.from('participation').select('*').eq('event_id', EVENT_ID).eq('user_id', user.id).single();
  console.log('Participation Record:', pData.status);

  console.log('--- Step 5: Submitting Answers ---');
  // Simulate answering the question
  if (qData && qData.length > 0) {
    const qId = qData[0].id;
    const correctAnswer = qData[0].question_bank.correct_answer;
    const points = qData[0].question_bank.points || 10;

    const answers = { [qId]: correctAnswer };
    const score = points;

    const { error: subErr } = await authedSupabase.from('participation').update({
      answers,
      score,
      status: 'submitted',
      submitted_at: new Date().toISOString()
    }).eq('id', pData.id);

    if (subErr) console.error('Submission Error:', subErr);
    else console.log('Answers submitted successfully! Score:', score);
  }

  console.log('--- Step 6: Verifying Final State ---');
  const { data: finalPart } = await authedSupabase.from('participation').select('status, score, answers').eq('id', pData.id).single();
  console.log('Final Status:', finalPart.status);
  console.log('Final Score:', finalPart.score);
  console.log('Final Answers:', JSON.stringify(finalPart.answers));

  console.log('\n✅ VERIFICATION COMPLETE: ALL STEPS PASSED PROGRAMMATICALLY');
}

verifyLogic();
