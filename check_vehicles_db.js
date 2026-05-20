const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function run() {
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:imhK3YrE2gv5G%28.@db.upylurzbdtuagbejyyuz.supabase.co:5432/postgres";
  console.log("Using Connection String:", connectionString.replace(/:([^@]+)@/, ':****@'));
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'vehicles'
      ORDER BY ordinal_position;
    `);
    console.log("Vehicles columns in database:", res.rows.map(r => ({ column_name: r.column_name, data_type: r.data_type })));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
