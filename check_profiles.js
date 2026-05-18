const { createClient } = require('@supabase/supabase-js');
const url = 'https://upylurzbdtuagbejyyuz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVweWx1cnpiZHR1YWdiZWp5eXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk0Njg2OCwiZXhwIjoyMDkwNTIyODY4fQ.tAPFGkL5ByIGu3zchJ044XXJnwMn69SCQxJrdp98dm8';
const supabase = createClient(url, key);

async function checkProfiles() {
  console.log('Fetching all profiles from Supabase...');
  const { data: profiles, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error('Failed:', error.message);
  } else {
    console.log('Profiles:');
    profiles.forEach(p => {
      console.log(`- ID: ${p.id} | Name: ${p.full_name} | Role: ${p.role} | Email/Phone: ${p.phone_number}`);
    });
  }
}

checkProfiles();
