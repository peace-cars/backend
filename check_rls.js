const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.upylurzbdtuagbejyyuz:imhK3YrE2gv5G%28.@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });
  await client.connect();
  
  // Check RLS on trade_in_requests
  const res1 = await client.query(`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class 
    WHERE relname IN ('trade_in_requests', 'sourcing_requests');
  `);
  console.log('RLS Status:', res1.rows);

  const res2 = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
    FROM pg_policies 
    WHERE tablename IN ('trade_in_requests', 'sourcing_requests')
    ORDER BY tablename, policyname;
  `);
  console.log('Policies:');
  res2.rows.forEach(r => console.log(`  ${r.tablename}: ${r.policyname} (${r.cmd}) => ${r.qual}`));

  await client.end();
}
main().catch(console.error);
