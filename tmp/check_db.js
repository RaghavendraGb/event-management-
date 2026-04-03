import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jfqynyxhzusyiwavuijg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcXlueXhoenVzeWl3YXZ1aWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjY4NjEsImV4cCI6MjA5MDc0Mjg2MX0._5clBR5d0gCd-LXiB4mEcXyV486nODPXI0hVE-OwOwA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('--- EVENTS ---');
  const { data: events, error: eErr } = await supabase.from('events').select('*');
  if (eErr) console.error('E-ERROR:', eErr);
  else console.log('E-DATA:', JSON.stringify(events, null, 2));

  console.log('--- QUESTIONS ---');
  const { data: questions, error: qErr } = await supabase.from('question_bank').select('*').limit(5);
  if (qErr) console.error('Q-ERROR:', qErr);
  else console.log('Q-DATA:', JSON.stringify(questions, null, 2));

  console.log('--- USERS ---');
  const { data: users, error: uErr } = await supabase.from('users').select('*').limit(5);
  if (uErr) console.error('U-ERROR:', uErr);
  else console.log('U-DATA:', JSON.stringify(users, null, 2));
}

checkData();
