const { createClient } = require('@supabase/supabase-js');
const url = 'https://culpdlgvvqxdvbyhmuyi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bHBkbGd2dnF4ZHZieWhtdXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4NzM4NCwiZXhwIjoyMDk3ODYzMzg0fQ.NRkAtJ7oBzTlbOXkMtqqdFZ3UWiNFXTaEZNrphGBgB4';
const supabase = createClient(url, key);

async function check() {
  console.log('Checking role_type enum values...');
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: `SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'role_type';`
  });

  if (error) {
    console.error('Check failed:', error.message);
  } else {
    console.log('Role types:', data.map(r => r.enumlabel));
  }
}

check();
