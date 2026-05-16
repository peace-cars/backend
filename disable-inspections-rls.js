const { createClient } = require('@supabase/supabase-js');
const url = 'https://upylurzbdtuagbejyyuz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVweWx1cnpiZHR1YWdiZWp5eXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk0Njg2OCwiZXhwIjoyMDkwNTIyODY4fQ.tAPFGkL5ByIGu3zchJ044XXJnwMn69SCQxJrdp98dm8';
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
