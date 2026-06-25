const { createClient } = require('@supabase/supabase-js');
const url = 'https://culpdlgvvqxdvbyhmuyi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bHBkbGd2dnF4ZHZieWhtdXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4NzM4NCwiZXhwIjoyMDk3ODYzMzg0fQ.NRkAtJ7oBzTlbOXkMtqqdFZ3UWiNFXTaEZNrphGBgB4';
const supabase = createClient(url, key);

async function repair() {
  console.log('--- SYSTEM REPAIR: ROLE ID ASSIGNMENT ---');
  
  // 1. Fetch all roles
  const { data: roles, error: rolesError } = await supabase.from('roles').select('*');
  if (rolesError) {
    console.error('Failed to fetch roles:', rolesError);
    return;
  }
  console.log(`Found ${roles.length} roles in system.`);

  // 2. Fetch all profiles where role_id is null but role is set
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, role')
    .is('role_id', null);
  
  if (profilesError) {
    console.error('Failed to fetch profiles:', profilesError);
    return;
  }
  console.log(`Found ${profiles.length} profiles with missing role_id.`);

  // 3. Update each profile
  for (const profile of profiles) {
    const roleMatch = roles.find(r => r.name === profile.role);
    if (roleMatch) {
      console.log(`Updating user ${profile.id}: Setting role_id for ${profile.role} (${roleMatch.id})`);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role_id: roleMatch.id })
        .eq('id', profile.id);
      
      if (updateError) {
        console.error(`Failed updating ${profile.id}:`, updateError.message);
      }
    } else {
      console.log(`No role match found for user ${profile.id} with role: ${profile.role}`);
    }
  }

  console.log('--- REPAIR COMPLETE ---');
}

repair();
