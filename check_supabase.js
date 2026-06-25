const SUPABASE_URL = "https://culpdlgvvqxdvbyhmuyi.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bHBkbGd2dnF4ZHZieWhtdXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4NzM4NCwiZXhwIjoyMDk3ODYzMzg0fQ.NRkAtJ7oBzTlbOXkMtqqdFZ3UWiNFXTaEZNrphGBgB4";

async function run() {
  try {
    // Check all profiles
    const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    });
    const profiles = await profRes.json();
    console.log("All Profiles Count:", profiles.length);
    if (profiles.length > 0) {
        console.log("Sample Profile:", profiles[0]);
    }
    const myProfile = profiles.find(p => p.id === '45d6b97d-0449-4fbf-95d9-02e1ff8878eb');
    console.log("My Profile (by ID 45d...):", myProfile || "Not Found");
    
    // Attempt to get user email (if it matches any profile)
    // we can't easily query auth.users from REST API natively without admin rights, but we can try RPC if there's one.
  } catch(e) {
    console.error(e);
  }
}
run();
