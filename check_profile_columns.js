const { createClient } = require('@supabase/supabase-js');
const url = 'https://culpdlgvvqxdvbyhmuyi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bHBkbGd2dnF4ZHZieWhtdXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4NzM4NCwiZXhwIjoyMDk3ODYzMzg0fQ.NRkAtJ7oBzTlbOXkMtqqdFZ3UWiNFXTaEZNrphGBgB4';
const supabase = createClient(url, key);

async function check() {
  console.log('Checking columns for table: profiles...');
  const { data, error } = await supabase.from('profiles').select('*').limit(1);

  if (error) {
    console.error('Fetch failed:', error.message);
  } else if (data && data.length > 0) {
    console.log('Profile keys:', Object.keys(data[0]));
    console.log('Profile sample:', data[0]);
  } else {
    console.log('No profiles found.');
  }
}

check();
