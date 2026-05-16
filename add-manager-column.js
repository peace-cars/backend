// Migration: Add manager_id column to locations table
// Run: node backend/add-manager-column.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL?.replace(/"/g, '');
const supabaseKey = process.env.SUPABASE_KEY?.replace(/"/g, '');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('Adding manager_id column to locations table...');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE locations 
      ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id);
    `
  });

  if (error) {
    // Try direct SQL if rpc not available
    console.log('RPC not available, trying direct column add via insert test...');
    
    // Check if column already exists by trying to select it
    const { error: checkError } = await supabase
      .from('locations')
      .select('manager_id')
      .limit(1);
    
    if (checkError && checkError.message.includes('manager_id')) {
      console.error('Column does not exist and cannot be added via JS client.');
      console.log('\n=== MANUAL SQL REQUIRED ===');
      console.log('Run this SQL in your Supabase SQL Editor:\n');
      console.log('ALTER TABLE locations ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id);');
      console.log('\n===========================\n');
    } else {
      console.log('✅ Column manager_id already exists on locations table!');
    }
  } else {
    console.log('✅ Successfully added manager_id column to locations table.');
  }
}

migrate().catch(console.error);
