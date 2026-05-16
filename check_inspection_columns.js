const { createClient } = require('@supabase/supabase-js');
const url = 'https://upylurzbdtuagbejyyuz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVweWx1cnpiZHR1YWdiZWp5eXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk0Njg2OCwiZXhwIjoyMDkwNTIyODY4fQ.tAPFGkL5ByIGu3zchJ044XXJnwMn69SCQxJrdp98dm8';
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('inspections').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('Inspections keys:', Object.keys(data[0]));
  } else {
    // If no data, we can try to get column names from another way or just assume schema.sql
    console.log('No inspection records found to check columns.');
  }
}
check();
