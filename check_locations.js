const { createClient } = require('@supabase/supabase-js');
const url = 'https://culpdlgvvqxdvbyhmuyi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bHBkbGd2dnF4ZHZieWhtdXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4NzM4NCwiZXhwIjoyMDk3ODYzMzg0fQ.NRkAtJ7oBzTlbOXkMtqqdFZ3UWiNFXTaEZNrphGBgB4';
const supabase = createClient(url, key);

async function check() {
  console.log('Checking locations...');
  const { data: locs, error: err1 } = await supabase.from('locations').select('*').limit(2);
  if (err1) {
    console.error('Locations fetch failed:', err1.message);
  } else {
    console.log('Locations keys:', locs && locs.length > 0 ? Object.keys(locs[0]) : 'None');
    console.log('Locations sample:', locs);
  }

  console.log('Checking branches...');
  const { data: branches, error: err2 } = await supabase.from('branches').select('*').limit(2);
  if (err2) {
    console.error('Branches fetch failed:', err2.message);
  } else {
    console.log('Branches keys:', branches && branches.length > 0 ? Object.keys(branches[0]) : 'None');
    console.log('Branches sample:', branches);
  }
}

check();
