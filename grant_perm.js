const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/SUPABASE_URL="(.*)"/)[1];
const supabaseKey = env.match(/SUPABASE_KEY="(.*)"/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPermissions() {
  // Find DISTRICT_MANAGER role
  const { data: roleData } = await supabase.from('roles').select('id').eq('name', 'DISTRICT_MANAGER').single();
  if (!roleData) return console.log('Role not found');
  
  // Find or create inventory.delete permission
  let { data: permData } = await supabase.from('permissions').select('id').eq('slug', 'inventory.delete').single();
  if (!permData) {
    const { data: newPerm, error } = await supabase.from('permissions').insert({ slug: 'inventory.delete', name: 'Delete Inventory', description: 'Can delete inventory' }).select('id').single();
    if (error) return console.log('Failed to create perm', error);
    permData = newPerm;
  }
  
  // Link them
  const { error } = await supabase.from('role_permissions').insert({ role_id: roleData.id, permission_id: permData.id });
  if (error && error.code !== '23505') console.log('Link error', error);
  else console.log('Permission granted to DISTRICT_MANAGER');
}

fixPermissions();
