import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db.js';

// Vercel cron jobs pass an authorization header
export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date();
    
    // Find all expired pending reservations
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: {
          lt: now
        }
      }
    });

    let releasedCount = 0;
    let failedCount = 0;

    // Process each individually to avoid massive deadlocks and partial massive failures
    for (const reservation of expiredReservations) {
      try {
        await prisma.$transaction(async (tx) => {
          // 1. Lock reservation row
          const resRows = await tx.$queryRaw`
            SELECT id, status FROM "Reservation" WHERE id = ${reservation.id} FOR UPDATE
          `;
          
          if (resRows.length === 0 || resRows[0].status !== "PENDING") {
            return; // Already processed by concurrent user action or previous cron cycle
          }

          // 2. Lock inventory row
          await tx.$queryRaw`
            SELECT id FROM "Inventory" 
            WHERE "productId" = ${reservation.productId} AND "warehouseId" = ${reservation.warehouseId} 
            FOR UPDATE
          `;

          // 3. Update reservation to RELEASED
          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: "RELEASED" }
          });

          // 4. Decrement reservedStock only (item was never officially sold)
          await tx.inventory.update({
            where: {
              productId_warehouseId: {
                productId: reservation.productId,
                warehouseId: reservation.warehouseId
              }
            },
            data: {
              reservedStock: { decrement: reservation.quantity }
            }
          });
        });
        
        releasedCount++;
      } catch (err) {
        console.error(`Failed to expire reservation ${reservation.id}:`, err);
        failedCount++;
      }
    }

    return NextResponse.json({ 
      message: "Expiry cleanup completed", 
      processed: expiredReservations.length,
      released: releasedCount,
      failed: failedCount
    }, { status: 200 });

  } catch (error) {
    console.error("Cron Expiry API Error:", error);
    return NextResponse.json({ error: "Unexpected error during expiry cleanup" }, { status: 500 });
  }
}
