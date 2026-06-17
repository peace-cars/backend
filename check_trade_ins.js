const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  const { data, error } = await supabase.from('trade_in_requests').select('id, vehicle_make_model');
  console.log(JSON.stringify(data, null, 2));
}
run();
