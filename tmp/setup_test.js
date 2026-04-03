import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jfqynyxhzusyiwavuijg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcXlueXhoenVzeWl3YXZ1aWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjY4NjEsImV4cCI6MjA5MDc0Mjg2MX0._5clBR5d0gCd-LXiB4mEcXyV486nODPXI0hVE-OwOwA';

const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_USER = {
  email: 'test_user_' + Math.random().toString(36).substring(7) + '@example.com',
  password: 'TestPassword123!',
  name: 'Test User'
};

async function setupTest() {
  console.log('Creating test user:', TEST_USER.email);
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: TEST_USER.email,
    password: TEST_USER.password,
    options: { data: { full_name: TEST_USER.name, college: 'Test College' } }
  });

  if (authErr) {
    console.error('Auth Error:', authErr);
    return;
  }
  const userId = authData.user.id;
  console.log('User created:', userId);

  // Auto-approve user
  const { error: appErr } = await supabase.from('users').update({ status: 'approved' }).eq('id', userId);
  if (appErr) console.warn('Approve Error (ignoring if RLS prevents):', appErr);

  // Create/Get an event
  console.log('Finding or creating a Live event...');
  let { data: liveEvent } = await supabase.from('events').select('*').eq('status', 'live').limit(1).single();

  if (!liveEvent) {
    console.log('No live event found, creating one...');
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour later
    const { data: newEvent, error: evErr } = await supabase.from('events').insert([{
      title: 'Test Live Exam',
      description: 'A test event for verification.',
      type: 'quiz',
      status: 'live',
      start_at: start.toISOString(),
      end_at: end.toISOString()
    }]).select().single();

    if (evErr) {
      console.error('Event Creation Error:', evErr);
      return;
    }
    liveEvent = newEvent;
  }
  console.log('Target Event:', liveEvent.id, liveEvent.title);

  // Check for questions
  const { data: questions } = await supabase.from('event_questions').select('*').eq('event_id', liveEvent.id);
  if (!questions || questions.length === 0) {
    console.log('No questions found for event, adding one...');
    // Create a question in bank first
    const { data: qBank, error: qBankErr } = await supabase.from('question_bank').insert([{
      question: 'What is the capital of France?',
      options: ['Paris', 'London', 'Berlin', 'Madrid'],
      correct_answer: 'Paris',
      difficulty: 'easy'
    }]).select().single();
    
    if (qBankErr) {
      console.error('Question Bank Error:', qBankErr);
    } else {
      await supabase.from('event_questions').insert([{
        event_id: liveEvent.id,
        question_id: qBank.id,
        order_num: 1
      }]);
      console.log('Question added to event.');
    }
  }

  console.log('\n--- VERIFICATION READY ---');
  console.log('Login Email:', TEST_USER.email);
  console.log('Login Password:', TEST_USER.password);
  console.log('Live Event ID:', liveEvent.id);
}

setupTest();
