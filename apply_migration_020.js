const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.upylurzbdtuagbejyyuz:imhK3YrE2gv5G%28.@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });
  await client.connect();

  // Apply migration 020
  await client.query(`
    CREATE TABLE IF NOT EXISTS community_post_upvotes (
      post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
      created_at timestamptz DEFAULT now() NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );
  `);
  console.log('Created community_post_upvotes table');

  await client.query(`ALTER TABLE community_post_upvotes ENABLE ROW LEVEL SECURITY;`);
  console.log('Enabled RLS');

  // Policies (idempotent with IF NOT EXISTS via DROP IF EXISTS)
  await client.query(`DROP POLICY IF EXISTS "Users can read all upvotes" ON community_post_upvotes;`);
  await client.query(`CREATE POLICY "Users can read all upvotes" ON community_post_upvotes FOR SELECT USING (true);`);

  await client.query(`DROP POLICY IF EXISTS "Users can cast their own upvote" ON community_post_upvotes;`);
  await client.query(`CREATE POLICY "Users can cast their own upvote" ON community_post_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);`);

  await client.query(`DROP POLICY IF EXISTS "Users can remove their own upvote" ON community_post_upvotes;`);
  await client.query(`CREATE POLICY "Users can remove their own upvote" ON community_post_upvotes FOR DELETE USING (auth.uid() = user_id);`);
  console.log('Created RLS policies');

  // Toggle upvote RPC
  await client.query(`
    CREATE OR REPLACE FUNCTION toggle_community_upvote(p_post_id uuid, p_user_id uuid)
    RETURNS jsonb AS $$
    DECLARE
      v_inserted boolean := false;
      v_new_count integer;
    BEGIN
      INSERT INTO community_post_upvotes (post_id, user_id)
      VALUES (p_post_id, p_user_id)
      ON CONFLICT (post_id, user_id) DO NOTHING;

      GET DIAGNOSTICS v_inserted = ROW_COUNT;

      IF v_inserted THEN
        UPDATE community_posts
        SET upvotes = COALESCE(upvotes, 0) + 1
        WHERE id = p_post_id;
      ELSE
        DELETE FROM community_post_upvotes WHERE post_id = p_post_id AND user_id = p_user_id;
        UPDATE community_posts
        SET upvotes = GREATEST(COALESCE(upvotes, 1) - 1, 0)
        WHERE id = p_post_id;
      END IF;

      SELECT upvotes INTO v_new_count FROM community_posts WHERE id = p_post_id;
      RETURN jsonb_build_object('voted', v_inserted, 'upvotes', v_new_count);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);
  console.log('Created toggle_community_upvote function');

  // Indexes
  await client.query(`CREATE INDEX IF NOT EXISTS idx_community_post_upvotes_user ON community_post_upvotes(user_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_community_post_upvotes_post ON community_post_upvotes(post_id);`);
  console.log('Created indexes');

  // Reload PostgREST schema cache
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log('Reloaded PostgREST schema cache');

  await client.end();
  console.log('Migration 020 applied successfully!');
}
main().catch(console.error);
