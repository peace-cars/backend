const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tradeIns = await prisma.trade_in_requests.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    select: { id: true, customer_id: true, user_asking_price_etb: true, status: true, vehicle_make_model: true }
  });
  console.log('Trade-ins:', JSON.stringify(tradeIns, null, 2));

  const sourcings = await prisma.sourcing_requests.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    select: { id: true, customer_id: true, status: true, make: true, model: true }
  });
  console.log('Sourcings:', JSON.stringify(sourcings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
