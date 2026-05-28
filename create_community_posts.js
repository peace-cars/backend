const { Client } = require('pg');

const connectionString = 'postgresql://postgres.upylurzbdtuagbejyyuz:imhK3YrE2gv5G%28.@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  const query = `
    CREATE TABLE IF NOT EXISTS public.community_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      upvotes INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Public profiles are viewable by everyone." 
      ON public.community_posts FOR SELECT 
      USING ( true );

    CREATE POLICY "Users can insert their own posts." 
      ON public.community_posts FOR INSERT 
      WITH CHECK ( auth.uid() = user_id );

    CREATE POLICY "Users can update upvotes." 
      ON public.community_posts FOR UPDATE
      USING ( true );
  `;

  try {
    await client.query(query);
    console.log('Successfully created community_posts table and policies.');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    await client.end();
  }
}

main();
