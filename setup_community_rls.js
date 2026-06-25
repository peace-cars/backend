const { Client } = require('pg');

const connectionString = 'postgresql://postgres.culpdlgvvqxdvbyhmuyi:AlphaOmegaFirstLast10@aws-1-eu-west-2.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  const rlsQuery = `
    -- Allow public read access
    CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'community');

    -- Allow authenticated users to upload
    CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT WITH CHECK (
      bucket_id = 'community' AND auth.role() = 'authenticated'
    );

    -- Allow users to update/delete their own uploads
    CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE USING (
      bucket_id = 'community' AND auth.uid() = owner
    );
    CREATE POLICY "Auth Delete" ON storage.objects FOR DELETE USING (
      bucket_id = 'community' AND auth.uid() = owner
    );
  `;

  try {
    await client.query(rlsQuery);
    console.log('✅ Added RLS policies for community storage bucket');
  } catch (error) {
    if (error.code === '42710') {
      console.log('✅ Policies already exist');
    } else {
      console.error('Policy update error:', error.message);
    }
  } finally {
    await client.end();
  }
}

main();
