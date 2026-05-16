const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: 'postgresql://postgres:imhK3YrE2gv5G%28.@db.upylurzbdtuagbejyyuz.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // Check which columns already exist on vehicles
    const { rows: cols } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vehicles' 
      ORDER BY ordinal_position
    `);
    console.log('Current vehicles columns:', cols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

    // Add images column if it doesn't exist
    await client.query(`
      ALTER TABLE vehicles 
      ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}'::text[]
    `);
    console.log('Added "images" column (text[]).');

    // Add battery_soh_percent column if it doesn't exist
    await client.query(`
      ALTER TABLE vehicles 
      ADD COLUMN IF NOT EXISTS battery_soh_percent integer DEFAULT NULL
    `);
    console.log('Added "battery_soh_percent" column (integer).');

    // Verify
    const { rows: afterCols } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vehicles' 
      ORDER BY ordinal_position
    `);
    console.log('Updated vehicles columns:', afterCols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
