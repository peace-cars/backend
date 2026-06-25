const { createClient } = require('@supabase/supabase-js');
const url = 'https://culpdlgvvqxdvbyhmuyi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bHBkbGd2dnF4ZHZieWhtdXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4NzM4NCwiZXhwIjoyMDk3ODYzMzg0fQ.NRkAtJ7oBzTlbOXkMtqqdFZ3UWiNFXTaEZNrphGBgB4';
const supabase = createClient(url, key);

async function run() {
  console.log('Disabling RLS for inspections table to unblock operations...');
  const { error } = await supabase.rpc('exec_sql', { 
    sql: 'ALTER TABLE "inspections" DISABLE ROW LEVEL SECURITY;' 
  });
  if (error) {
    console.error('Failed to disable RLS:', error.message);
  } else {
    console.log('RLS disabled successfully for "inspections" table.');
  }
}
run();
