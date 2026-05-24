const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing old data...');
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  console.log('Seeding products...');
  const mouse = await prisma.product.create({
    data: { name: 'Wireless Mouse', sku: 'MOUSE-001', description: 'Ergonomic wireless mouse' }
  });
  const keyboard = await prisma.product.create({
    data: { name: 'Mechanical Keyboard', sku: 'KEY-001', description: 'RGB mechanical keyboard' }
  });
  const monitor = await prisma.product.create({
    data: { name: '27-inch Monitor', sku: 'MON-001', description: '4K IPS display' }
  });

  console.log('Seeding warehouses...');
  const bangalore = await prisma.warehouse.create({
    data: { name: 'Bangalore Hub', location: 'Bangalore, KA' }
  });
  const chennai = await prisma.warehouse.create({
    data: { name: 'Chennai Hub', location: 'Chennai, TN' }
  });

  console.log('Seeding inventory...');
  await prisma.inventory.createMany({
    data: [
      { productId: mouse.id, warehouseId: bangalore.id, totalStock: 10, reservedStock: 0 },
      { productId: mouse.id, warehouseId: chennai.id, totalStock: 5, reservedStock: 0 },
      { productId: keyboard.id, warehouseId: bangalore.id, totalStock: 3, reservedStock: 0 },
      { productId: monitor.id, warehouseId: chennai.id, totalStock: 2, reservedStock: 0 },
    ]
  });

  console.log('Seed completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
