const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.culpdlgvvqxdvbyhmuyi:AlphaOmegaFirstLast10@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });
  await client.connect();
  
  const res = await client.query(`
    SELECT user_id, created_at
    FROM community_upvotes
    ORDER BY created_at DESC
    LIMIT 1;
  `);
  console.log('Latest Upvote:', res.rows[0]);

  if (res.rows[0]) {
    const userId = res.rows[0].user_id;
    const tradeIns = await client.query('SELECT * FROM trade_in_requests WHERE customer_id = $1', [userId]);
    console.log('Trade Ins for this user:', tradeIns.rows);

    const sourcings = await client.query('SELECT * FROM sourcing_requests WHERE customer_id = $1', [userId]);
    console.log('Sourcings for this user:', sourcings.rows);
  }

  await client.end();
}
main().catch(console.error);
