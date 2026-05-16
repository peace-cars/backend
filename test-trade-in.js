const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testSubmit() {
  // 1. Login as Client
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'client@peace.cars',
    password: 'password123'
  });
  
  if (authErr) {
    console.error("Login failed:", authErr.message);
    return;
  }
  
  const token = authData.session.access_token;
  console.log("Logged in as client.");

  // 2. Fetch locations
  const locRes = await fetch('http://localhost:3000/locations', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const locations = await locRes.json();
  const locationId = locations[0]?.id;

  if (!locationId) {
    console.error("No locations found.");
    return;
  }

  // 3. Submit Trade-in Request
  const res = await fetch('http://localhost:3000/trade-in-requests', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      vehicleMakeModel: '2024 Toyota Corolla',
      carDescription: 'Plate: Code 2, Mileage: 10000km',
      askingPrice: 1500000,
      locationId: locationId,
      photos: ['https://example.com/photo.jpg'],
      financingRequested: false
    })
  });

  const responseText = await res.text();
  console.log("Submit status:", res.status);
  console.log("Submit response:", responseText);
}

testSubmit();
