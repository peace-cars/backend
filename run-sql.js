const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = "postgresql://postgres.upylurzbdtuagbejyyuz:imhK3YrE2gv5G%28.@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, 'prisma/rpc.sql'), 'utf8');
    await client.query(sql);
    console.log('SQL executed successfully!');
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

run();
