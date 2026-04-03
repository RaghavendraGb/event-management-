import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://jfqynyxhzusyiwavuijg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcXlueXhoenVzeWl3YXZ1aWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjY4NjEsImV4cCI6MjA5MDc0Mjg2MX0._5clBR5d0gCd-LXiB4mEcXyV486nODPXI0hVE-OwOwA'
);

const admins = [
  { email: 'usiddik331@gmail.com',     password: 'siddik@123', name: 'Abubakar Siddik' },
  { email: 'raghavendragb2@gmail.com',  password: '123456',     name: 'Raghavendra GB'  },
];

console.log('\nCreating admin accounts...\n');

for (const a of admins) {
  const { data, error } = await sb.auth.signUp({
    email: a.email,
    password: a.password,
    options: { data: { full_name: a.name } }
  });

  if (error) {
    if (error.message.includes('already registered') || error.status === 422) {
      console.log(`[EXISTS]  ${a.email} — already registered (role set by SQL patch)`);
    } else {
      console.log(`[FAILED]  ${a.email} — ${error.message}`);
    }
  } else {
    console.log(`[CREATED] ${a.email} — id: ${data?.user?.id}`);
  }
}

console.log('\nDone! Now run database/patch_and_admins.sql in Supabase Dashboard to set admin roles.\n');
