const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT pol.polname, pol.polcmd, pol.polqual, pol.polwithcheck 
    FROM pg_policy pol
    JOIN pg_class cls ON pol.polrelid = cls.oid
    WHERE cls.relname = 'vehicles';
  `);
  console.log('Vehicles RLS Policies:');
  for (const row of res.rows) {
    console.log(`- ${row.polname} (${row.polcmd}):`);
    console.log(`  USING: ${row.polqual}`);
    if (row.polwithcheck) console.log(`  WITH CHECK: ${row.polwithcheck}`);
  }
  await client.end();
}
main().catch(console.error);
