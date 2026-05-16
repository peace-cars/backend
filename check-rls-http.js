const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkRLS() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('trade_in_requests', 'conversations', 'messages', 'profiles', 'vehicles', 'branches')"
  });
  
  if (error) {
    console.error("RPC failed, trying raw data fetch to infer RLS:", error.message);
    // If RPC is not defined, we can't easily check pg_class via PostgREST.
    // We'll just assume RLS is disabled if we can fetch all data without a user JWT 
    // using the ANON key. 
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

checkRLS();
