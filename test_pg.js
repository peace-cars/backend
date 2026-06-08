const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  
  console.log('Trade-in requests:');
  const res = await client.query('SELECT id, customer_id, vehicle_make_model, created_at, status FROM trade_in_requests ORDER BY created_at DESC LIMIT 5');
  console.log(res.rows);

  console.log('Sourcing requests:');
  const res2 = await client.query('SELECT id, customer_id, make, model, created_at, status FROM sourcing_requests ORDER BY created_at DESC LIMIT 5');
  console.log(res2.rows);

  await client.end();
}
main().catch(console.error);
