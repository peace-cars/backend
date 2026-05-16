const { createClient } = require('@supabase/supabase-js');
const url = 'https://upylurzbdtuagbejyyuz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVweWx1cnpiZHR1YWdiZWp5eXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk0Njg2OCwiZXhwIjoyMDkwNTIyODY4fQ.tAPFGkL5ByIGu3zchJ044XXJnwMn69SCQxJrdp98dm8';
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inspections';`
  });

  if (error) {
    console.error('Check failed:', error.message);
  } else {
    console.log('Inspections columns details:', JSON.stringify(data, null, 2));
  }
}

check();
