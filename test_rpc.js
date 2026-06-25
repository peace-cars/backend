const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.culpdlgvvqxdvbyhmuyi:AlphaOmegaFirstLast10@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });
  await client.connect();
  
  const res = await client.query(`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_name = 'toggle_community_upvote'
  `);
  console.log('RPC exists:', res.rows.length > 0);

  await client.end();
}
main().catch(console.error);
