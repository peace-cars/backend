const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT policyname, cmd, roles, qual, with_check 
    FROM pg_policies
    WHERE tablename = 'vehicles';
  `);
  console.log('Vehicles RLS Policies:');
  for (const row of res.rows) {
    console.log(`- ${row.policyname} (${row.cmd}) [${row.roles}]:`);
    console.log(`  USING: ${row.qual}`);
    if (row.with_check) console.log(`  WITH CHECK: ${row.with_check}`);
  }
  await client.end();
}
main().catch(console.error);
