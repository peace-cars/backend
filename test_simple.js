const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.upylurzbdtuagbejyyuz:imhK3YrE2gv5G%28.@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });
  await client.connect();
  
  const res = await client.query('SELECT id, customer_id, vehicle_make_model, created_at, status FROM trade_in_requests ORDER BY created_at DESC LIMIT 5');
  console.log('TradeIn:', res.rows);

  const res2 = await client.query('SELECT id, customer_id, make, model, created_at, status FROM sourcing_requests ORDER BY created_at DESC LIMIT 5');
  console.log('Sourcing:', res2.rows);

  await client.end();
}
main().catch(console.error);
