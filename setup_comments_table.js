require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_DATABASE_URL,
  });

  await client.connect();

  console.log('Creating community_comments table...');

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.community_comments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    
    await client.query(`ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;`);

    try { await client.query(`DROP POLICY IF EXISTS "comments_read_all" ON public.community_comments;`); } catch(e){}
    await client.query(`CREATE POLICY "comments_read_all" ON public.community_comments FOR SELECT USING (true);`);

    try { await client.query(`DROP POLICY IF EXISTS "comments_insert_auth" ON public.community_comments;`); } catch(e){}
    await client.query(`CREATE POLICY "comments_insert_auth" ON public.community_comments FOR INSERT WITH CHECK (true);`);

    try { await client.query(`DROP POLICY IF EXISTS "comments_update_owner" ON public.community_comments;`); } catch(e){}
    await client.query(`CREATE POLICY "comments_update_owner" ON public.community_comments FOR UPDATE USING (true);`);

    console.log('✅ community_comments table created successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
