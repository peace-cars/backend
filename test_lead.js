const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/SUPABASE_URL="(.*)"/)[1];
const supabaseKey = env.match(/SUPABASE_KEY="(.*)"/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('trade_in_requests').select('customer_id').limit(5);
  console.log(error || data);
}

test();
