const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.upylurzbdtuagbejyyuz:imhK3YrE2gv5G%28.@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });
  await client.connect();
  
  const profiles = await client.query('SELECT id, full_name, role, created_at FROM profiles ORDER BY created_at DESC LIMIT 5');
  console.log('Latest Profiles:', profiles.rows);

  await client.end();
}
main().catch(console.error);
