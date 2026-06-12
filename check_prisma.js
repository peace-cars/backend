const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env' });
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  const policies = await prisma.$queryRaw`SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'vehicles'`;
  console.log('Vehicles Policies:', policies);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
