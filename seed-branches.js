const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function seedBranches() {
  const branches = [
    { name: 'Addis Ababa Central', address: 'Bole, Near Edna Mall' },
    { name: 'Bahir Dar Branch', address: 'Main Road, Near Lake Tana' },
    { name: 'Adama Hub', address: 'Main Station Area' }
  ];

  console.log('Seeding branches...');
  const { data, error } = await supabase.from('branches').insert(branches).select();

  if (error) {
    console.error('Error seeding branches:', error);
  } else {
    console.log('Successfully seeded branches:', data);
  }
}

seedBranches();
