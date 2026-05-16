const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres:imhK3YrE2gv5G%28.@db.upylurzbdtuagbejyyuz.supabase.co:5432/postgres",
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    const sql = `
      -- 1. Ensure Columns Exist
      ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "checklist" JSONB DEFAULT '{}';
      ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "detailed_photos" JSONB DEFAULT '[]';
      ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "ev_data" JSONB DEFAULT '{}';
      ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "final_notes" TEXT;

      -- 2. Setup RLS
      ALTER TABLE "inspections" ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Inspections: Staff can insert for assigned leads" ON "inspections";
      DROP POLICY IF EXISTS "Inspections: Staff can read evaluations" ON "inspections";
      DROP POLICY IF EXISTS "Inspections: GM full access" ON "inspections";

      CREATE POLICY "Inspections: Staff can insert for assigned leads"
        ON "inspections" FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM trade_in_requests
            WHERE id = trade_in_id
            AND (assigned_staff_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('DISTRICT_MANAGER', 'GENERAL_MANAGER'))
          )
        );

      CREATE POLICY "Inspections: Staff can read evaluations"
        ON "inspections" FOR SELECT
        USING (
          (SELECT role FROM profiles WHERE id = auth.uid()) IN ('STAFF', 'DISTRICT_MANAGER', 'GENERAL_MANAGER', 'FINANCE_AUDITOR')
        );

      CREATE POLICY "Inspections: GM full access"
        ON "inspections" FOR ALL
        USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'GENERAL_MANAGER')
        WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'GENERAL_MANAGER');

      -- 3. Ensure staff_tasks has completed_at
      ALTER TABLE "staff_tasks" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP WITH TIME ZONE;
    `;

    await client.query(sql);
    console.log('Database migration and RLS setup completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
