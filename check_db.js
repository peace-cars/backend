const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.upylurzbdtuagbejyyuz:imhK3YrE2gv5G%28.@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });
  await client.connect();
  
  const tradeIns = await client.query('SELECT * FROM trade_in_requests ORDER BY created_at DESC LIMIT 5');
  console.log('Latest Trade Ins:', tradeIns.rows.map(r => ({id: r.id, customer_id: r.customer_id, created_at: r.created_at})));

  const sourcings = await client.query('SELECT * FROM sourcing_requests ORDER BY created_at DESC LIMIT 5');
  console.log('Latest Sourcings:', sourcings.rows.map(r => ({id: r.id, customer_id: r.customer_id, created_at: r.created_at})));

  await client.end();
}
main().catch(console.error);
