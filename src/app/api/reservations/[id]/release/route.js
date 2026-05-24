import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db.js';

export async function POST(req, { params }) {
  try {
    const { id } = await params;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock the reservation row database-side to prevent simultaneous confirm/release
      const resRows = await tx.$queryRaw`
        SELECT * FROM "Reservation" WHERE id = ${id} FOR UPDATE
      `;

      if (resRows.length === 0) {
        throw new Error("RESERVATION_NOT_FOUND");
      }

      const reservation = resRows[0];

      // 2. Validate status. Only PENDING reservations can be released.
      if (reservation.status !== "PENDING") {
         throw new Error(`INVALID_STATE_${reservation.status}`);
      }
      
      // Note: We don't block release if expired. If it's expired, it *should* be released to free up stock.

      // 3. Lock the inventory row
      await tx.$queryRaw`
        SELECT id FROM "Inventory" 
        WHERE "productId" = ${reservation.productId} AND "warehouseId" = ${reservation.warehouseId} 
        FOR UPDATE
      `;

      // 4. Update reservation status to RELEASED
      const updatedReservation = await tx.reservation.update({
        where: { id },
        data: { status: "RELEASED" }
      });

      // 5. Decrement reservedStock only (totalStock remains unchanged because item was not officially sold)
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

      return updatedReservation;
    });

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    if (error.message === "RESERVATION_NOT_FOUND") {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (error.message.startsWith("INVALID_STATE_")) {
      const state = error.message.replace("INVALID_STATE_", "");
      return NextResponse.json({ error: `Cannot release. Reservation is already ${state}` }, { status: 400 });
    }
    console.error("Release API Error:", error);
    return NextResponse.json({ error: "Unexpected error releasing reservation" }, { status: 500 });
  }
}
