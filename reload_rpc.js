const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.culpdlgvvqxdvbyhmuyi:AlphaOmegaFirstLast10@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });
  await client.connect();
  
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log('Schema reloaded successfully.');

  await client.end();
}
main().catch(console.error);
