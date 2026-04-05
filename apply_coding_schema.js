import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

// Password requires URL encoding since it has a '#' character
const password = encodeURIComponent('uydnsu42h#5');
const connectionString = `postgresql://postgres.jfqynyxhzusyiwavuijg:${password}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;

async function applyCodingSchema() {
  const client = new Client({ connectionString });
  
  try {
    console.log('Connecting to Supabase Database...');
    await client.connect();
    
    console.log('Reading database/coding_schema.sql...');
    const sqlScript = fs.readFileSync(path.resolve('./database/coding_schema.sql'), 'utf8');
    
    console.log('Executing Coding Schema SQL...');
    await client.query(sqlScript);
    
    console.log('✅ Coding Schema applied successfully!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

applyCodingSchema();
