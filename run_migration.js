const { createClient } = require('@supabase/supabase-js');
const url = 'https://culpdlgvvqxdvbyhmuyi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bHBkbGd2dnF4ZHZieWhtdXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4NzM4NCwiZXhwIjoyMDk3ODYzMzg0fQ.NRkAtJ7oBzTlbOXkMtqqdFZ3UWiNFXTaEZNrphGBgB4';
const supabase = createClient(url, key);

async function runMigration() {
  console.log('Running migration 004 (certified_km + RLS)...');
  
  const sql = `
    -- 1. Add missing column
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS certified_km INT;
    UPDATE vehicles SET certified_km = current_mileage WHERE certified_km IS NULL AND current_mileage IS NOT NULL;

    -- 2. Fix RLS Policies for vehicles
    DROP POLICY IF EXISTS "GM bypass" ON vehicles;
    DROP POLICY IF EXISTS "Admin and GM manage vehicles" ON vehicles;
    CREATE POLICY "Admin and GM manage vehicles" ON vehicles FOR ALL USING (public.get_my_role() IN ('ADMIN', 'GENERAL_MANAGER')) WITH CHECK (public.get_my_role() IN ('ADMIN', 'GENERAL_MANAGER'));

    DROP POLICY IF EXISTS "Staff manage vehicles" ON vehicles;
    CREATE POLICY "Staff manage vehicles" ON vehicles FOR ALL USING (public.get_my_role() IN ('STAFF', 'DISTRICT_MANAGER')) WITH CHECK (public.get_my_role() IN ('STAFF', 'DISTRICT_MANAGER'));
  `;

  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Migration failed via RPC:', error.message);
    console.log('Please run the migration manually using migrations/004_add_certified_km.sql in the Supabase SQL Editor.');
  } else {
    console.log('Migration completed successfully!');
  }
}

runMigration();
