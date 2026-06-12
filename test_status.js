const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/SUPABASE_URL="([^"]+)"/);
const keyMatch = env.match(/SUPABASE_KEY="([^"]+)"/);

if (!urlMatch || !keyMatch) {
  console.log('Failed to parse .env');
  process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function test() {
  const { data, error } = await supabase.from('trade_in_requests').select('id, status').limit(5);
  console.log('Leads:', data);
  if (data && data.length > 0) {
    const leadId = data[0].id;
    const { error: patchError } = await supabase.from('trade_in_requests').update({status: 'ACCEPTED'}).eq('id', leadId);
    console.log('Update Error:', patchError);
  }
}
test();
