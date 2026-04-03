import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

// Password requires URL encoding since it has a '#' character
const password = encodeURIComponent('uydnsu42h#5');
const connectionString = `postgresql://postgres.jfqynyxhzusyiwavuijg:${password}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;

async function applySchema() {
  const client = new Client({ connectionString });
  
  try {
    console.log('Connecting to Supabase Database...');
    await client.connect();
    
    console.log('Reading database/schema.sql...');
    const sqlScript = fs.readFileSync(path.resolve('./database/schema.sql'), 'utf8');
    
    console.log('Executing SQL (This might take a few seconds)...');
    await client.query(sqlScript);
    
    console.log('✅ Schema application successful!');
  } catch (err) {
    console.error('❌ Error:', err.message, err.code);
  } finally {
    await client.end();
  }
}

applySchema();
