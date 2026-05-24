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

      // 2. Prevent invalid state transitions
      if (reservation.status !== "PENDING") {
        throw new Error(`INVALID_STATE_${reservation.status}`);
      }

      // 3. Validate not expired
      if (new Date() > new Date(reservation.expiresAt)) {
        throw new Error("RESERVATION_EXPIRED");
      }

      // 4. Lock the corresponding inventory row (prevents race conditions with other confirms/releases)
      await tx.$queryRaw`
        SELECT id FROM "Inventory" 
        WHERE "productId" = ${reservation.productId} AND "warehouseId" = ${reservation.warehouseId} 
        FOR UPDATE
      `;

      // 5. Update reservation status to CONFIRMED
      const updatedReservation = await tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" }
      });

      // 6. Permanently reduce both totalStock and reservedStock
      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId
          }
        },
        data: {
          totalStock: { decrement: reservation.quantity },
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
      return NextResponse.json({ error: `Cannot confirm. Reservation is already ${state}` }, { status: 400 });
    }
    if (error.message === "RESERVATION_EXPIRED") {
      return NextResponse.json({ error: "Reservation has expired and cannot be confirmed. It must be released." }, { status: 410 });
    }
    console.error("Confirm API Error:", error);
    return NextResponse.json({ error: "Unexpected error confirming reservation" }, { status: 500 });
  }
}
