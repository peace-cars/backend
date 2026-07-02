const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.culpdlgvvqxdvbyhmuyi:AlphaOmegaFirstLast10@aws-1-eu-west-2.pooler.supabase.com:5432/postgres'
});

async function run() {
  await client.connect();
  try {
    await client.query('ALTER TABLE vehicles ALTER COLUMN vin_chassis DROP NOT NULL;');
    console.log('Successfully dropped NOT NULL constraint on vin_chassis');
  } catch (err) {
    console.error('Error altering table:', err);
  } finally {
    await client.end();
  }
}

run();
