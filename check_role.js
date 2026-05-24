const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/SUPABASE_URL="(.*)"/)[1];
const supabaseKey = env.match(/SUPABASE_KEY="(.*)"/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const { data: profile } = await supabase
    .from('profiles')
    .select(`*, roles (name, role_permissions(permissions(slug)))`)
    .eq('id', 'f37c88dd-4f9f-4821-aed4-4450236ab36f')
    .single();
    
  console.log(JSON.stringify(profile, null, 2));
}

checkUser();
