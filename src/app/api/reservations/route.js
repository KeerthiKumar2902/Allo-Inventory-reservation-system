import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db.js';

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

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current inventory to validate stock
      const inventory = await tx.inventory.findUnique({
        where: {
          productId_warehouseId: { productId, warehouseId }
        }
      });

      if (!inventory) {
        throw new Error("INVENTORY_NOT_FOUND");
      }

      const availableStock = inventory.totalStock - inventory.reservedStock;

      if (availableStock < quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      // 2. Create pending reservation (10 minute expiry)
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

      // 3. Increment reserved stock
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedStock: { increment: quantity }
        }
      });

      return reservation;
    });

    return NextResponse.json(result, { status: 201 });

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
