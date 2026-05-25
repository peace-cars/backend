const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/SUPABASE_URL="(.*)"/)[1];
const supabaseKey = env.match(/SUPABASE_KEY="(.*)"/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase.from('trade_in_requests').update({
    vehicle_details: {
      "body_type": "Sedan",
      "color": "Silver",
      "fuel_type": "PETROL",
      "transmission": "AUTOMATIC",
      "drive_type": "FWD",
      "engine_cc": 1800,
      "duty_status": "PAID",
      "libre_status": "CLEAN",
      "num_owners": "1",
      "accident_history": "CLEAN",
      "insurance_status": "COMPREHENSIVE",
      "import_origin": "GULF",
      "mileage": 45000,
      "vin": "JTDB"
    }
  }).eq('id', '607ec5ce-d87d-4839-93bc-3ada18184fa4');
  if (error) {
    console.error(error);
  } else {
    console.log("Updated vehicle details.");
  }
}

checkColumns();
