const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing old data...');
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  console.log('Seeding products...');
  // Standard medical placeholder image that works reliably
  const defaultImage = 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80'; 

  const amox = await prisma.product.create({
    data: { name: 'Amoxicillin 500mg', sku: 'MED-AMOX-500', description: 'Broad-spectrum antibiotic.', imageUrl: defaultImage }
  });
  const ibu = await prisma.product.create({
    data: { name: 'Ibuprofen 400mg', sku: 'MED-IBU-400', description: 'Nonsteroidal anti-inflammatory drug.', imageUrl: defaultImage }
  });
  const insulin = await prisma.product.create({
    data: { name: 'Novolog Insulin Pen', sku: 'MED-NOV-PEN', description: 'Fast-acting mealtime insulin.', imageUrl: defaultImage }
  });
  const steth = await prisma.product.create({
    data: { name: 'Littmann Classic III', sku: 'EQP-LITT-C3', description: 'High acoustic sensitivity stethoscope.', imageUrl: defaultImage }
  });
  const paracetamol = await prisma.product.create({
    data: { name: 'Paracetamol 500mg', sku: 'MED-PARA-500', description: 'Fever reducer and pain reliever.', imageUrl: defaultImage }
  });
  const bandages = await prisma.product.create({
    data: { name: 'Surgical Bandages', sku: 'MED-BAND-01', description: 'Sterile surgical bandages.', imageUrl: defaultImage }
  });

  console.log('Seeding warehouses...');
  const bangalore = await prisma.warehouse.create({ data: { name: 'Bangalore Depot', location: 'Bangalore, KA' } });
  const chennai = await prisma.warehouse.create({ data: { name: 'Chennai Hub', location: 'Chennai, TN' } });
  const mumbai = await prisma.warehouse.create({ data: { name: 'Mumbai Central', location: 'Mumbai, MH' } });
  const delhi = await prisma.warehouse.create({ data: { name: 'Delhi MedCorp', location: 'Delhi, DL' } });

  console.log('Seeding inventory...');
  await prisma.inventory.createMany({
    data: [
      { productId: amox.id, warehouseId: bangalore.id, totalStock: 40, reservedStock: 0 },
      { productId: amox.id, warehouseId: chennai.id, totalStock: 2, reservedStock: 0 },
      { productId: amox.id, warehouseId: mumbai.id, totalStock: 5, reservedStock: 0 },
      
      { productId: ibu.id, warehouseId: bangalore.id, totalStock: 6, reservedStock: 0 },
      { productId: ibu.id, warehouseId: delhi.id, totalStock: 1, reservedStock: 0 },
      
      { productId: insulin.id, warehouseId: chennai.id, totalStock: 30, reservedStock: 0 },
      { productId: insulin.id, warehouseId: mumbai.id, totalStock: 0, reservedStock: 0 },
      
      { productId: steth.id, warehouseId: bangalore.id, totalStock: 2, reservedStock: 0 },
      { productId: steth.id, warehouseId: delhi.id, totalStock: 5, reservedStock: 0 },

      { productId: paracetamol.id, warehouseId: mumbai.id, totalStock: 100, reservedStock: 0 },
      { productId: paracetamol.id, warehouseId: chennai.id, totalStock: 40, reservedStock: 0 },

      { productId: bandages.id, warehouseId: bangalore.id, totalStock: 10, reservedStock: 0 },
      { productId: bandages.id, warehouseId: delhi.id, totalStock: 20, reservedStock: 0 },
    ]
  });

  console.log('Seed completed successfully!');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
