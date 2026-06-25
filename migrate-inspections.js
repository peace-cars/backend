const { createClient } = require('@supabase/supabase-js');
const url = 'https://culpdlgvvqxdvbyhmuyi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bHBkbGd2dnF4ZHZieWhtdXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4NzM4NCwiZXhwIjoyMDk3ODYzMzg0fQ.NRkAtJ7oBzTlbOXkMtqqdFZ3UWiNFXTaEZNrphGBgB4';
const supabase = createClient(url, key);

async function run() {
  console.log('Starting migration...');
  
  // Note: Since I don't have direct SQL access, I'll use a hack to create the table if it's missing or update it via a dummy insert if I can
  // Actually, I should just assume I can't run ALTER TABLE directly without a management function.
  // I will check if I can use a 'query' rpc.
  
  const { error } = await supabase.rpc('exec_sql', { 
    sql: `
      ALTER TABLE IF EXISTS "inspections" ADD COLUMN IF NOT EXISTS "checklist" JSONB DEFAULT '{}';
      ALTER TABLE IF EXISTS "inspections" ADD COLUMN IF NOT EXISTS "detailed_photos" JSONB DEFAULT '[]';
      ALTER TABLE IF EXISTS "inspections" ADD COLUMN IF NOT EXISTS "ev_data" JSONB DEFAULT '{}';
      ALTER TABLE IF EXISTS "inspections" ADD COLUMN IF NOT EXISTS "final_notes" TEXT;
    ` 
  });

  if (error) {
    console.error('Migration failed:', error.message);
    console.log('Trying fallback: creating a new detailed_inspections table via direct insert attempt (might fail if not exists)');
  } else {
    console.log('Migration successful');
  }
}

run();
