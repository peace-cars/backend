const { createClient } = require('@supabase/supabase-js');
const url = 'https://culpdlgvvqxdvbyhmuyi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bHBkbGd2dnF4ZHZieWhtdXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4NzM4NCwiZXhwIjoyMDk3ODYzMzg0fQ.NRkAtJ7oBzTlbOXkMtqqdFZ3UWiNFXTaEZNrphGBgB4';
const supabase = createClient(url, key);

async function setupScope() {
  console.log('--- SYSTEM SETUP: DISTRICT SCOPE ASSIGNMENT ---');
  
  const BOLE_HQ = '55555555-5555-5555-5555-555555555555';
  const DM_USER = 'f37c88dd-4f9f-4821-aed4-4450236ab36f';
  const STAFF_USERS = [
    '4f970a3f-f97d-4192-9d1c-976ff7f739a4',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
  ];

  // 1. Assign DM to Bole HQ
  console.log(`Assigning District Manager ${DM_USER} to location ${BOLE_HQ}`);
  const { error: dmError } = await supabase
    .from('profiles')
    .update({ location_id: BOLE_HQ })
    .eq('id', DM_USER);
  
  if (dmError) console.error('DM Update failed:', dmError.message);

  // 2. Assign Staff to Bole HQ
  for (const staffId of STAFF_USERS) {
    console.log(`Assigning Staff ${staffId} to location ${BOLE_HQ}`);
    const { error: staffError } = await supabase
      .from('profiles')
      .update({ location_id: BOLE_HQ })
      .eq('id', staffId);
    
    if (staffError) console.error(`Staff ${staffId} update failed:`, staffError.message);
  }

  console.log('--- SCOPE SETUP COMPLETE ---');
}

setupScope();
