const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.upylurzbdtuagbejyyuz:imhK3YrE2gv5G%28.@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });
  await client.connect();
  
  const res = await client.query(`
    SELECT polname, cmd, qual, with_check 
    FROM pg_policy 
    WHERE polrelid = 'trade_in_requests'::regclass;
  `);
  console.log('Trade-In Policies:', res.rows);

  const res2 = await client.query(`
    SELECT polname, cmd, qual, with_check 
    FROM pg_policy 
    WHERE polrelid = 'sourcing_requests'::regclass;
  `);
  console.log('Sourcing Policies:', res2.rows);

  await client.end();
}
main().catch(console.error);
