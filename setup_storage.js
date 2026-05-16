const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Service Role Key required for bucket creation

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKETS = [
  { name: 'profiles', public: true },
  { name: 'listings', public: true },
  { name: 'banners', public: true },
  { name: 'documents', public: false }
];

async function setupStorage() {
  console.log('🚀 Starting Supabase Storage Initialization...');

  for (const bucket of BUCKETS) {
    console.log(`\n📦 Checking bucket: ${bucket.name}...`);
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error(`❌ Error listing buckets: ${listError.message}`);
      continue;
    }

    const exists = buckets.find(b => b.name === bucket.name);

    if (!exists) {
      console.log(`➕ Creating bucket: ${bucket.name} (public: ${bucket.public})`);
      const { error: createError } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        allowedMimeTypes: bucket.name === 'documents' ? ['application/pdf', 'image/*'] : ['image/*'],
        fileSizeLimit: 5242880 // 5MB
      });

      if (createError) {
        console.error(`❌ Error creating bucket ${bucket.name}: ${createError.message}`);
      } else {
        console.log(`✅ Bucket ${bucket.name} created successfully.`);
      }
    } else {
      console.log(`ℹ️ Bucket ${bucket.name} already exists.`);
    }

    // Set up basic RLS policies (Note: This usually requires SQL, but we can try via API if supported or just document it)
    console.log(`🔐 Note: Please ensure RLS policies for '${bucket.name}' are configured in the Supabase Dashboard for full security.`);
  }

  console.log('\n✨ Storage Initialization Complete.');
}

setupStorage().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
