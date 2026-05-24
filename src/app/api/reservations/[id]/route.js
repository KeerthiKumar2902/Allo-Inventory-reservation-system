import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db.js';

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true }
    });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    return NextResponse.json(reservation, { status: 200 });
  } catch (error) {
    console.error("Fetch Reservation API Error:", error);
    return NextResponse.json({ error: "Failed to fetch reservation" }, { status: 500 });
  }
}
