const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/SUPABASE_URL="(.*)"/)[1];
const supabaseKey = env.match(/SUPABASE_KEY="(.*)"/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase.from('vehicles').select('id, images, created_at, make').eq('id', '7ea2a5f4-e198-43a4-b117-23f790f6bde9').single();
  if (error) {
    console.error(error);
  } else {
    console.log(data);
  }
}

checkColumns();
