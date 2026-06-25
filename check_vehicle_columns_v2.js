const { createClient } = require('@supabase/supabase-js');
const url = 'https://culpdlgvvqxdvbyhmuyi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bHBkbGd2dnF4ZHZieWhtdXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4NzM4NCwiZXhwIjoyMDk3ODYzMzg0fQ.NRkAtJ7oBzTlbOXkMtqqdFZ3UWiNFXTaEZNrphGBgB4';
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vehicles' ORDER BY ordinal_position;`
  });

  if (error) {
    console.error('Check failed:', error.message);
  } else {
    console.log('Detailed Vehicles columns:', JSON.stringify(data, null, 2));
  }
}

check();
