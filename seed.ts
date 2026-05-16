import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || ''; // Must be Service Role Key to use supabase.auth.admin

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE Credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BOLE_ID = '33333333-3333-3333-3333-333333333333';
const MEG_ID  = '44444444-4444-4444-4444-444444444444';
const SAR_ID  = '55555555-5555-5555-5555-555555555555';

async function setupAuthUser(email: string, fullName: string) {
  // Check if exists
  const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) { console.error("Error listing auth users:", listErr); throw listErr; }
  
  const existingUser = usersData.users.find(u => u.email === email);
  if (existingUser) {
    console.log(`[Auth] User ${email} already exists. Using ID: ${existingUser.id}`);
    return existingUser.id;
  }

  // Set unified password for all seeded users for easy testing 
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });

  if (error) { console.error(`Failed to create ${email}:`, error); throw error; }
  console.log(`[Auth] Created user ${email} with ID: ${data.user.id}`);
  return data.user.id;
}

async function seed() {
  console.log("🚀 Initializing Live Database Seed Protocol...");

  // 1. Setup Auth Users
  const adminId = await setupAuthUser('admin@peacecars.com', 'Admin Boss');
  const dawitId = await setupAuthUser('dawit@peacecars.com', 'Dawit Kebede');
  const salemId = await setupAuthUser('salem@peacecars.com', 'Salem Tesfaye');
  const customerId = await setupAuthUser('samamuel@gmail.com', 'Samuel Tadesse');
  const financeId = await setupAuthUser('finance@peacecars.com', 'Lydia Finance');

  // 2. Locations
  console.log("📍 Seeding Locations...");
  const { error: locErr } = await supabase.from('locations').upsert([
    { id: BOLE_ID, name: 'Bole Auto Mall', code: 'BOLE-HQ', address: 'Bole Road', phone_number: '+251 111 22 33', is_active: true },
    { id: MEG_ID, name: 'Megenagna Lot', code: 'MEG-01', address: 'Megenagna Roundabout', phone_number: '+251 111 44 55', is_active: true },
    { id: SAR_ID, name: 'Sarbet Showroom', code: 'SAR-01', address: 'Sarbet Total', phone_number: '+251 111 66 77', is_active: false },
  ], { onConflict: 'id' });
  if (locErr) { console.error("Location Error:", locErr); throw locErr; }

  // 3. Profiles (Uses UUIDs from Auth)
  console.log("👥 Seeding Profiles...");
  const { error: profErr } = await supabase.from('profiles').upsert([
    { 
      id: dawitId, role: 'STAFF', full_name: 'Dawit Kebede', phone_number: '+251 900 1111', 
      location_id: BOLE_ID, is_verified: true, is_inspector_verified: true, gamification_points: 340, performance_rating: 4.8, total_completed_tasks: 12
    },
    { 
      id: salemId, role: 'STAFF', full_name: 'Salem Tesfaye', phone_number: '+251 900 2222', 
      location_id: MEG_ID, is_verified: true, is_inspector_verified: false, gamification_points: 120, performance_rating: 4.2, total_completed_tasks: 5
    },
    {
      id: adminId, role: 'GENERAL_MANAGER', full_name: 'Admin Boss', phone_number: '+251 900 3333',
      is_verified: true, performance_rating: 5.0, total_completed_tasks: 0
    },
    {
      id: customerId, role: 'USER', full_name: 'Samuel Tadesse', phone_number: '+251 900 4444',
      is_verified: true, performance_rating: 5.0, total_completed_tasks: 0
    },
    {
      id: financeId, role: 'FINANCE_AUDITOR', full_name: 'Lydia Finance', phone_number: '+251 900 5555',
      location_id: BOLE_ID, is_verified: true, performance_rating: 5.0, total_completed_tasks: 0
    }
  ], { onConflict: 'id' });
  if (profErr) { console.error("Profile Error:", profErr); throw profErr; }

  // 4. Vehicles
  console.log("🚗 Seeding Inventory...");
  const { error: vehErr } = await supabase.from('vehicles').upsert([
    {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // Required valid UUIDs
      vin_chassis: 'V-TOY-300-24-X291A', make: 'Toyota', model: 'Land Cruiser 300 VX', year: 2024,
      retail_price_etb: 24500000, total_landed_cost_etb: 18000000,
      duty: 'DUTY_PAID', fuel: 'DIESEL', location_id: BOLE_ID, status: 'SHOWROOM'
    },
    {
       id: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
       vin_chassis: 'V-BYD-SONG-24-X91ZZ', make: 'BYD', model: 'Song Plus EV', year: 2024,
       retail_price_etb: 4500000, total_landed_cost_etb: 3900000,
       duty: 'DUTY_FREE', fuel: 'ELECTRIC', battery_soh_percent: 100, location_id: MEG_ID, status: 'SHOWROOM'
    }
  ], { onConflict: 'id' });
  if (vehErr) { console.error("Vehicle Error:", vehErr); throw vehErr; }

  // 5. Trade In Requests
  console.log("📋 Seeding Trade-In Leads...");
  const { error: tradeErr } = await supabase.from('trade_in_requests').upsert([
    {
      id: 'a1111111-1111-1111-1111-111111111111', customer_id: customerId, vehicle_make_model: '2020 Hyundai Tucson',
      car_description: 'Code 3 - A 19022', user_asking_price_etb: 3600000,
      target_vehicle_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', location_id: BOLE_ID,
      assigned_staff_id: dawitId, status: 'NEW_LEAD'
    },
    {
      id: 'a2222222-2222-2222-2222-222222222222', customer_id: customerId, vehicle_make_model: '2019 Toyota Corolla',
      car_description: 'Code 2 - B 92833', user_asking_price_etb: 2200000,
      target_vehicle_id: 'c56a4180-65aa-42ec-a945-5fd21dec0538', location_id: MEG_ID,
      assigned_staff_id: salemId, status: 'NEW_LEAD'
    }
  ], { onConflict: 'id' });
  // trade_in_requests uses VARCHAR primary key so uuid format is optional. Wait! The schema says id is VARCHAR(50) for trade_in_requests.
  if (tradeErr) { console.error("Trade-In Error:", tradeErr); throw tradeErr; }

  // 6. Achievements Catalog
  console.log("🏆 Seeding Gamification Catalog...");
  const { error: achErr } = await supabase.from('staff_achievements_catalog').upsert([
    { name: 'First Inspection', description: 'Survive your first technical vetting.', point_value: 50 },
    { name: 'Eagle Eye', description: 'Detect high-risk fault in Engine diagnostic.', point_value: 150 },
    { name: 'Lead Closer', description: 'Convert a Trade-In request into confirmed inventory.', point_value: 300 }
  ], { onConflict: 'name' });
  if (achErr) { console.error("Achievements Error:", achErr); throw achErr; }

  // 7. System Settings
  console.log("⚙️ Seeding System Operations...");
  const { error: setErr } = await supabase.from('system_settings').upsert([
    { key: 'exchange_rate_usd_etb', value: '125.00' },
    { key: 'default_commission_broker_percent', value: '2.0' },
    { key: 'default_commission_staff_percent', value: '1.0' }
  ], { onConflict: 'key' });
  if (setErr) { console.error("System Settings Error:", setErr); throw setErr; }

  // 8. ERP Tasks and Budgets
  console.log("🛠️ Seeding ERP Sandbox Data...");
  const { error: taskErr } = await supabase.from('staff_tasks').upsert([
    {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', assigned_by: adminId, assigned_to: dawitId, trade_in_id: 'a1111111-1111-1111-1111-111111111111',
      priority: 'HIGH', status: 'ASSIGNED', description: 'Inspect the 2020 Hyundai Tucson. Urgent evaluation requested.',
      location_coordinates: '(9.005401, 38.763611)'
    }
  ], { onConflict: 'id' });
  if (taskErr) { console.error("Tasks Error:", taskErr); throw taskErr; }

  const { error: budErr } = await supabase.from('staff_budgets').upsert([
    {
      id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff', requester_id: dawitId,
      amount_requested: 1500.00, purpose: 'Fuel for Megenagna inspection trip', status: 'REQUESTED'
    }
  ], { onConflict: 'id' });
  if (budErr) { console.error("Budgets Error:", budErr); throw budErr; }

  console.log("✅ LIVE SEED COMPLETE.");
}

seed().catch(err => {
  console.error("Critical Failure:", err);
  process.exit(1);
});
