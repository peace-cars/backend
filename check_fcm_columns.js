const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
  const { data, error } = await supabase.from('profiles').select('fcm_token, fcm_meta').limit(1);
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Columns exist! Data:', data);
  }
}

check();
