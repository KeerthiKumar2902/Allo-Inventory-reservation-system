import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db.js';
import { acquireLock, releaseLock } from '@/lib/redis.js';
import { withIdempotency } from '@/lib/idempotency.js';

const reserveSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number().int().positive(),
});

export async function POST(req) {
  return withIdempotency(req, async () => {
    try {
      const body = await req.json();
      const parsed = reserveSchema.safeParse(body);
      
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request payload", details: parsed.error.format() }, { status: 400 });
      }

      const { productId, warehouseId, quantity } = parsed.data;
      const lockKey = `lock:inventory:${productId}:${warehouseId}`;

      const lockAcquired = await acquireLock(lockKey, 10);
      if (!lockAcquired) {
        return NextResponse.json({ error: "System busy. High traffic for this item. Please try again." }, { status: 409 });
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
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

          if (availableStock < quantity) {
            throw new Error("INSUFFICIENT_STOCK");
          }

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
  });
}
