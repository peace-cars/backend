const { createClient } = require('@supabase/supabase-js');
const url = 'https://culpdlgvvqxdvbyhmuyi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bHBkbGd2dnF4ZHZieWhtdXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4NzM4NCwiZXhwIjoyMDk3ODYzMzg0fQ.NRkAtJ7oBzTlbOXkMtqqdFZ3UWiNFXTaEZNrphGBgB4';
const supabase = createClient(url, key);

async function run() {
  console.log('Applying RLS for inspections table...');
  
  const sql = `
    -- Enable RLS
    ALTER TABLE "inspections" ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies
    DROP POLICY IF EXISTS "Inspections: Staff can insert for assigned leads" ON "inspections";
    DROP POLICY IF EXISTS "Inspections: Staff can read evaluations" ON "inspections";
    DROP POLICY IF EXISTS "Inspections: GM full access" ON "inspections";

    -- 1. Staff can insert an inspection if they are assigned to the trade-in request
    -- Note: We check against the trade_in_requests table
    CREATE POLICY "Inspections: Staff can insert for assigned leads"
      ON "inspections" FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM trade_in_requests
          WHERE id = trade_in_id
          AND (assigned_staff_id = auth.uid() OR public.get_my_role() IN ('DISTRICT_MANAGER', 'GENERAL_MANAGER'))
        )
      );

    -- 2. Staff and Managers can read evaluations
    CREATE POLICY "Inspections: Staff can read evaluations"
      ON "inspections" FOR SELECT
      USING (
        public.get_my_role() IN ('STAFF', 'DISTRICT_MANAGER', 'GENERAL_MANAGER', 'FINANCE_AUDITOR')
      );

    -- 3. GMs can do everything
    CREATE POLICY "Inspections: GM full access"
      ON "inspections" FOR ALL
      USING (public.get_my_role() = 'GENERAL_MANAGER')
      WITH CHECK (public.get_my_role() = 'GENERAL_MANAGER');
  `;

  // We use the same 'exec_sql' RPC if it exists, or we assume the user can run this.
  // Since I saw it in migrate-inspections.js, I'll try it.
  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Failed to apply RLS via RPC:', error.message);
    console.log('Please run the SQL manually in Supabase SQL Editor:');
    console.log(sql);
  } else {
    console.log('RLS policies applied successfully to "inspections" table.');
  }
}

run();
