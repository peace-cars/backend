require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_DATABASE_URL,
  });

  await client.connect();

  console.log('Creating community_events table...');

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.community_events (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        event_date TIMESTAMPTZ NOT NULL,
        location TEXT,
        cover_image TEXT,
        event_type TEXT DEFAULT 'meetup',
        rsvp_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    
    await client.query(`ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;`);

    try { await client.query(`DROP POLICY IF EXISTS "events_read_all" ON public.community_events;`); } catch(e){}
    await client.query(`CREATE POLICY "events_read_all" ON public.community_events FOR SELECT USING (true);`);

    try { await client.query(`DROP POLICY IF EXISTS "events_insert_auth" ON public.community_events;`); } catch(e){}
    await client.query(`CREATE POLICY "events_insert_auth" ON public.community_events FOR INSERT WITH CHECK (true);`);

    try { await client.query(`DROP POLICY IF EXISTS "events_update_owner" ON public.community_events;`); } catch(e){}
    await client.query(`CREATE POLICY "events_update_owner" ON public.community_events FOR UPDATE USING (true);`);

    console.log('✅ community_events table created successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
