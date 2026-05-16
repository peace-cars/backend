const { createClient } = require('@supabase/supabase-js');

const url = "https://upylurzbdtuagbejyyuz.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVweWx1cnpiZHR1YWdiZWp5eXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk0Njg2OCwiZXhwIjoyMDkwNTIyODY4fQ.tAPFGkL5ByIGu3zchJ044XXJnwMn69SCQxJrdp98dm8";

const supabase = createClient(url, key);

async function checkVehicles() {
  const { data, error } = await supabase.from('vehicles').select('id, make, model').limit(5);
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Vehicles:', JSON.stringify(data, null, 2));
}

checkVehicles();
