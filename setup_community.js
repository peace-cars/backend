const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const connectionString = 'postgresql://postgres.culpdlgvvqxdvbyhmuyi:AlphaOmegaFirstLast10@aws-1-eu-west-2.pooler.supabase.com:5432/postgres';
const supabaseUrl = 'https://culpdlgvvqxdvbyhmuyi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bHBkbGd2dnF4ZHZieWhtdXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI4NzM4NCwiZXhwIjoyMDk3ODYzMzg0fQ.NRkAtJ7oBzTlbOXkMtqqdFZ3UWiNFXTaEZNrphGBgB4';

async function main() {
  // 1. Create storage bucket
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: existingBuckets } = await supabase.storage.listBuckets();
  const bucketExists = existingBuckets?.some(b => b.name === 'community');
  
  if (!bucketExists) {
    const { data, error } = await supabase.storage.createBucket('community', {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB max
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
    });
    if (error) {
      console.error('Bucket creation error:', error.message);
    } else {
      console.log('✅ Created "community" storage bucket');
    }
  } else {
    console.log('✅ "community" storage bucket already exists');
  }

  // 2. Update DB schema - add images and youtube_url columns
  const client = new Client({ connectionString });
  await client.connect();

  const alterQuery = `
    ALTER TABLE public.community_posts 
      ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS youtube_url TEXT,
      ADD COLUMN IF NOT EXISTS post_type VARCHAR(20) DEFAULT 'discussion';
  `;

  try {
    await client.query(alterQuery);
    console.log('✅ Added images, youtube_url, post_type columns to community_posts');
  } catch (error) {
    console.error('Schema update error:', error.message);
  } finally {
    await client.end();
  }
}

main();
