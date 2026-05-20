const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres:imhK3YrE2gv5G%28.@db.upylurzbdtuagbejyyuz.supabase.co:5432/postgres",
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    const sqlPath = path.join(__dirname, '..', 'migrations', '016_telegram_subscriptions.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found at ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Executing SQL migration:\n', sql);

    await client.query(sql);
    console.log('Migration 016_telegram_subscriptions completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
