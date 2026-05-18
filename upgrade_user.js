const { createClient } = require('@supabase/supabase-js');
const url = 'https://upylurzbdtuagbejyyuz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVweWx1cnpiZHR1YWdiZWp5eXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk0Njg2OCwiZXhwIjoyMDkwNTIyODY4fQ.tAPFGkL5ByIGu3zchJ044XXJnwMn69SCQxJrdp98dm8';
const supabase = createClient(url, key);

async function upgrade() {
  console.log('Fetching roles...');
  const { data: roles, error: rolesError } = await supabase.from('roles').select('*');
  if (rolesError) {
    console.error('Failed to fetch roles:', rolesError.message);
    return;
  }

  const gmRole = roles.find(r => r.name === 'GENERAL_MANAGER');
  if (!gmRole) {
    console.error('GENERAL_MANAGER role not found in system!');
    return;
  }
  console.log(`GENERAL_MANAGER Role ID: ${gmRole.id}`);

  console.log('Upgrading Zekariyas Atnafu to GENERAL_MANAGER...');
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ 
      role: 'GENERAL_MANAGER',
      role_id: gmRole.id 
    })
    .eq('id', 'd702d3a5-f108-4550-8eee-d463c739b493');

  if (updateError) {
    console.error('Upgrade failed:', updateError.message);
  } else {
    console.log('Zekariyas Atnafu upgraded to GENERAL_MANAGER successfully!');
  }
}

upgrade();
