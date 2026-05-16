const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  await client.connect();
  try {
    const res = await client.query(`
      ALTER TABLE public.conversations
      DROP CONSTRAINT IF EXISTS conversations_customer_id_fkey;

      ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    `);
    console.log("Success:", res);

    const res2 = await client.query(`
      ALTER TABLE public.messages
      DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

      ALTER TABLE public.messages
      ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    `);
    console.log("Success2:", res2);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
