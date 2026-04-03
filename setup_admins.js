// ============================================================
// EventX - Admin Setup & DB Patch Runner
// ============================================================
// Run: node setup_admins.js
// ============================================================

import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Client } = pg;

// ── DB Connection ──────────────────────────────────────────
const password = encodeURIComponent('uydnsu42h#5');
const connectionString = `postgresql://postgres.jfqynyxhzusyiwavuijg:${password}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;

// ── Supabase JS Client ─────────────────────────────────────
const supabase = createClient(
  'https://jfqynyxhzusyiwavuijg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcXlueXhoenVzeWl3YXZ1aWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjY4NjEsImV4cCI6MjA5MDc0Mjg2MX0._5clBR5d0gCd-LXiB4mEcXyV486nODPXI0hVE-OwOwA'
);

// ── Admin Accounts ─────────────────────────────────────────
const ADMINS = [
  { email: 'usiddik331@gmail.com',    password: 'siddik@123', name: 'Abubakar Siddik' },
  { email: 'raghavendragb2@gmail.com', password: '123456',     name: 'Raghavendra GB'  },
];

// ── Safe query runner (logs error but doesn't crash) ───────
async function safeQuery(client, label, sql) {
  try {
    await client.query(sql);
    console.log(`   ✅ ${label}`);
    return true;
  } catch (err) {
    // Skip "already exists" type errors — they are harmless
    const harmless = ['already exists', 'duplicate', 'does not exist'];
    const isHarmless = harmless.some(h => err.message.toLowerCase().includes(h));
    if (isHarmless) {
      console.log(`   ℹ️  ${label} (already applied — skipped)`);
    } else {
      console.warn(`   ⚠️  ${label} — ${err.message}`);
    }
    return false;
  }
}

// ── Step 1: Apply DB Patches ───────────────────────────────
async function applyPatches(client) {
  console.log('\n📦  Applying DB patches...');

  // PATCH 1 — Add 'completed' to participation_status enum
  // NOTE: Must run outside a transaction block (ALTER TYPE restriction)
  await safeQuery(client,
    'PATCH 1 — Add completed to participation_status enum',
    `ALTER TYPE participation_status ADD VALUE IF NOT EXISTS 'completed';`
  );

  // PATCH 2 — Fix answers column default: [] → {}
  await safeQuery(client,
    'PATCH 2 — Fix answers column default to {}',
    `ALTER TABLE participation ALTER COLUMN answers SET DEFAULT '{}'::jsonb;`
  );

  await safeQuery(client,
    'PATCH 2b — Fix existing [] rows to {}',
    `UPDATE participation SET answers = '{}'::jsonb
     WHERE jsonb_typeof(answers) = 'array' AND answers = '[]'::jsonb;`
  );

  // PATCH 3 — Update auth trigger to auto-elevate admin emails
  await safeQuery(client,
    'PATCH 3 — Update handle_new_user trigger with admin email list',
    `CREATE OR REPLACE FUNCTION public.handle_new_user()
     RETURNS TRIGGER AS $$
     DECLARE
       assigned_role user_role;
     BEGIN
       IF new.email IN ('usiddik331@gmail.com', 'raghavendragb2@gmail.com') THEN
         assigned_role := 'admin';
       ELSE
         assigned_role := 'user';
       END IF;
       INSERT INTO public.users (id, name, email, avatar_url, college, role)
       VALUES (
         new.id,
         COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
         new.email,
         new.raw_user_meta_data->>'avatar_url',
         new.raw_user_meta_data->>'college',
         assigned_role
       )
       ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
       RETURN new;
     END;
     $$ LANGUAGE plpgsql SECURITY DEFINER;`
  );

  // PATCH 4 — Immediately grant admin to those two emails if already in DB
  await safeQuery(client,
    'PATCH 4 — Set admin role for existing accounts',
    `UPDATE public.users SET role = 'admin'
     WHERE email IN ('usiddik331@gmail.com', 'raghavendragb2@gmail.com');`
  );

  // PATCH 5 — Fix Certificate RLS (users must be able to INSERT their own certs)
  await safeQuery(client, 'PATCH 5a — Drop old cert policy',
    `DROP POLICY IF EXISTS "Certificates writable by admins" ON certificates;`
  );
  await safeQuery(client, 'PATCH 5b — Create cert INSERT policy for users',
    `CREATE POLICY "Users can insert own certificate" ON certificates
     FOR INSERT WITH CHECK (auth.uid() = user_id);`
  );
  await safeQuery(client, 'PATCH 5c — Create cert UPDATE policy',
    `CREATE POLICY "Users can update own certificate" ON certificates
     FOR UPDATE USING (auth.uid() = user_id OR is_admin());`
  );
  await safeQuery(client, 'PATCH 5d — Admin cert delete policy',
    `CREATE POLICY "Admins can manage all certificates" ON certificates
     FOR DELETE USING (is_admin());`
  );

  // PATCH 6 — Broaden users SELECT policy for lobby/leaderboard participant names
  await safeQuery(client, 'PATCH 6a — Drop narrow users SELECT policy',
    `DROP POLICY IF EXISTS "Users can read their own data" ON users;`
  );
  await safeQuery(client, 'PATCH 6b — Create public users SELECT policy',
    `CREATE POLICY "Users publicly readable" ON users FOR SELECT USING (true);`
  );
  await safeQuery(client, 'PATCH 6c — Users can update own data',
    `CREATE POLICY "Users can update their own data" ON users
     FOR UPDATE USING (auth.uid() = id OR is_admin());`
  );
}

// ── Step 2: Create Auth Accounts ───────────────────────────
async function createAuthAccounts() {
  console.log('\n👥  Creating admin auth accounts...');

  for (const admin of ADMINS) {
    const { data, error } = await supabase.auth.signUp({
      email: admin.email,
      password: admin.password,
      options: { data: { full_name: admin.name } }
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered') || error.status === 422) {
        console.log(`   ℹ️  ${admin.email} — already registered (role will be set by SQL patch)`);
      } else {
        console.warn(`   ⚠️  ${admin.email} — ${error.message}`);
      }
    } else {
      console.log(`   ✅ ${admin.email} — auth account created (id: ${data?.user?.id ?? 'pending'})`);
    }
  }
}

// ── Step 3: Verify ─────────────────────────────────────────
async function verify(client) {
  console.log('\n🔍  Verifying admin roles...');
  try {
    const { rows } = await client.query(
      `SELECT email, role FROM public.users WHERE role = 'admin' ORDER BY email;`
    );
    if (rows.length === 0) {
      console.warn('   ⚠️  No admins found yet — accounts may need to sign in once to trigger the auth hook.');
    } else {
      rows.forEach(r => console.log(`   ✅ ${r.email}  [${r.role}]`));
    }
  } catch (e) {
    console.warn('   ⚠️  Could not verify:', e.message);
  }
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  console.log('━'.repeat(55));
  console.log('  EventX — Admin Setup & DB Patch');
  console.log('━'.repeat(55));

  const client = new Client({ connectionString });
  try {
    process.stdout.write('\n🔌  Connecting to Supabase DB... ');
    await client.connect();
    console.log('connected ✅');

    await applyPatches(client);
    await createAuthAccounts();
    await verify(client);

    console.log('\n' + '━'.repeat(55));
    console.log('  Setup Complete!');
    console.log('  usiddik331@gmail.com    → password: siddik@123  → admin');
    console.log('  raghavendragb2@gmail.com → password: 123456      → admin');
    console.log('  All other signups        → role: user  (default)');
    console.log('━'.repeat(55) + '\n');

  } catch (err) {
    console.error('\n❌ Fatal:', err.message);
  } finally {
    await client.end();
  }
}

main();
