require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DIRECT_DATABASE_URL });
client.connect().then(() => {
  return client.query('SELECT id FROM auth.users WHERE id = $1', ['35446dd5-34e1-48ce-aede-4e628f281032']);
}).then(res => {
  console.log(res.rows);
}).catch(console.error).finally(() => client.end());
