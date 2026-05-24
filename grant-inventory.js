require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    const { rows: roles } = await client.query(`SELECT id FROM "roles" WHERE name = 'DISTRICT_MANAGER'`);
    if (!roles.length) throw new Error('Role not found');
    
    const { rows: perms } = await client.query(`SELECT id FROM "permissions" WHERE slug = 'inventory.create'`);
    if (!perms.length) throw new Error('Permission not found');

    const roleId = roles[0].id;
    const permId = perms[0].id;

    await client.query(`
      INSERT INTO "role_permissions" (role_id, permission_id) 
      VALUES ($1, $2) 
      ON CONFLICT DO NOTHING
    `, [roleId, permId]);

    console.log('Permission granted');
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
