require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

async function run() {
  console.log('Reading init.sql...');
  let sql = fs.readFileSync('prisma/init.sql', 'utf16le');
  if (!sql.includes('CREATE')) {
    sql = fs.readFileSync('prisma/init.sql', 'utf8');
  }

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const filtered = statements.filter(stmt => {
    if (stmt.includes('"auth"')) return false;
    return true;
  });

  console.log(`Filtered statements: ${filtered.length} out of ${statements.length}`);

  const client = new Client({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
  });

  await client.connect();
  console.log('Connected to DB');

  let success = 0;
  let fail = 0;

  for (let i = 0; i < filtered.length; i++) {
    try {
      await client.query(filtered[i]);
      success++;
    } catch (e) {
      // Ignored errors like "relation already exists" might happen if partial run
      console.error(`\nFailed statement:\n${filtered[i].substring(0, 80)}...`);
      console.error(e.message);
      fail++;
    }
  }

  console.log(`\nSuccess: ${success}, Fail: ${fail}`);
  await client.end();
}

run().catch(console.error);
