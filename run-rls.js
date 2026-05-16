const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function runSQL() {
  await client.connect();
  try {
    const sql = fs.readFileSync('rls_setup.sql', 'utf8');
    await client.query(sql);
    console.log("Successfully applied RLS policies.");
  } catch (err) {
    console.error("Failed to apply RLS policies:", err);
  } finally {
    await client.end();
  }
}

runSQL();
