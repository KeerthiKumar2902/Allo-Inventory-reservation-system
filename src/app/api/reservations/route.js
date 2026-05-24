import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db.js';
import { acquireLock, releaseLock } from '@/lib/redis.js';

const reserveSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number().int().positive(),
});

export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = reserveSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload", details: parsed.error.format() }, { status: 400 });
    }

    const { productId, warehouseId, quantity } = parsed.data;
    const lockKey = `lock:inventory:${productId}:${warehouseId}`;

    // 1. Acquire Redis Lock (serialize access before hitting DB)
    // 10s TTL prevents deadlocks if server crashes during processing
    const lockAcquired = await acquireLock(lockKey, 10);
    if (!lockAcquired) {
      return NextResponse.json({ error: "System busy. High traffic for this item. Please try again." }, { status: 409 });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 2. Fetch current inventory to validate stock with FOR UPDATE 
        // This ensures database-level locking, preventing simultaneous modification
        const inventoryRows = await tx.$queryRaw`
          SELECT id, "totalStock", "reservedStock"
          FROM "Inventory"
          WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
          FOR UPDATE
        `;

        if (inventoryRows.length === 0) {
          throw new Error("INVENTORY_NOT_FOUND");
        }

        const inventory = inventoryRows[0];
        const availableStock = inventory.totalStock - inventory.reservedStock;

        // 3. Validate availability safely inside the locked transaction
        if (availableStock < quantity) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        // 4. Create pending reservation (10 minute expiry)
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 

        const reservation = await tx.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity,
            status: "PENDING",
            expiresAt
          }
        });

        // 5. Increment reserved stock
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            reservedStock: { increment: quantity }
          }
        });

        return reservation;
      });

      return NextResponse.json(result, { status: 201 });
      
    } finally {
      // 6. Release Redis Lock to allow the next request through
      await releaseLock(lockKey);
    }

  } catch (error) {
    if (error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "Insufficient stock available" }, { status: 409 });
    }
    if (error.message === "INVENTORY_NOT_FOUND") {
      return NextResponse.json({ error: "Inventory record not found" }, { status: 404 });
    }
    console.error("Reservation API Error:", error);
    return NextResponse.json({ error: "An unexpected error occurred processing your reservation" }, { status: 500 });
  }
}
