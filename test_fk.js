const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('community_posts').select('id, title, profiles!community_posts_user_id_fkey(full_name, avatar_url, username)').limit(1);
  console.log('Result:', error || 'Success');
}
run();
