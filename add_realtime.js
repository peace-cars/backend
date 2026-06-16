const { Client } = require('pg');
require('dotenv').config({ path: './.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  
  await client.query("ALTER PUBLICATION supabase_realtime ADD TABLE messages;");
  console.log('Added messages to supabase_realtime publication');

  await client.end();
}
main().catch(console.error);
