import pg from 'pg';
const { Client } = pg;

const password = encodeURIComponent('uydnsu42h#5');
const hosts = [
  'aws-0-ap-south-1.pooler.supabase.com',
  'db.jfqynyxhzusyiwavuijg.supabase.co'
];
const ports = [5432, 6543];

async function testConnections() {
  const configs = [
    { host: 'db.jfqynyxhzusyiwavuijg.supabase.co', port: 5432, user: 'postgres' },
    { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 5432, user: 'postgres.jfqynyxhzusyiwavuijg' },
    { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 6543, user: 'postgres.jfqynyxhzusyiwavuijg' }
  ];

  for (const config of configs) {
    console.log(`\n🔌 Testing ${config.user}@${config.host}:${config.port}...`);
    const client = new Client({ 
      host: config.host,
      port: config.port,
      user: config.user,
      password: 'uydnsu42h#5',
      database: 'postgres',
      connectionTimeoutMillis: 5000 
    });
    try {
      await client.connect();
      console.log(`   ✅ Success!`);
      await client.end();
      return; 
    } catch (err) {
      console.warn(`   ❌ Fail: ${err.message}`);
    }
  }
}

testConnections();
