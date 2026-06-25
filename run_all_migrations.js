const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

const url = process.env.SUPABASE_URL || 'https://culpdlgvvqxdvbyhmuyi.supabase.co';
const key = process.env.SUPABASE_KEY; // Using service_role key to run administrative SQL
const supabase = createClient(url, key);

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const migrationFiles = [
  '012_role_scoping_and_rls.sql',
  '013_financial_ledger_and_crypto_audit.sql',
  '014_workflow_state_machines.sql'
];

async function run() {
  console.log("==========================================================================");
  console.log("PeaceCars ERP Hardening: Remote Supabase Migration Runner");
  console.log("==========================================================================\n");

  if (!key) {
    console.error("❌ SUPABASE_KEY (service_role) is missing in .env!");
    return;
  }

  for (const filename of migrationFiles) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    console.log(`Reading migration: ${filename}...`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration file not found: ${filePath}`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`Applying ${filename} via Supabase RPC exec_sql...`);
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error(`❌ Migration ${filename} failed:`, error.message);
      console.log("Please run it manually in the Supabase SQL editor.\n");
      // Stop execution on failure
      return;
    }

    console.log(`✅ Applied ${filename} successfully!\n`);
  }

  console.log("==========================================================================");
  console.log("🏆 ALL HARDENING MIGRATIONS COMPLETED SUCCESSFULLY");
  console.log("==========================================================================\n");
}

run();
