import pg from 'pg';
const { Client } = pg;

const password = encodeURIComponent('uydnsu42h#5');
const connectionString = `postgresql://postgres.jfqynyxhzusyiwavuijg:${password}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;

async function fixDb() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to DB');

    // 1. Add user_status enum if not exists
    console.log('Updating user_status enum...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_status AS ENUM ('pending', 'approved', 'blocked');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Add status column to users if not exists
    console.log('Adding status column to users...');
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status user_status DEFAULT 'pending';
    `);

    // 3. Add 'completed' to participation_status enum
    console.log('Updating participation_status enum...');
    await client.query(`
      ALTER TYPE participation_status ADD VALUE IF NOT EXISTS 'completed';
    `);

    console.log('✅ DB Fix successful!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

fixDb();
