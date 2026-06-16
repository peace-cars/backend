const { Client } = require('pg');
require('dotenv').config({ path: './.env' }); // Assuming we run in backend dir

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  
  const res = await client.query("SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';");
  console.log(res.rows);

  await client.end();
}
main().catch(console.error);
