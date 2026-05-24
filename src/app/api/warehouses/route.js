import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db.js';

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      select: {
        id: true,
        name: true,
        location: true,
        createdAt: true,
      }
    });
    return NextResponse.json(warehouses);
  } catch (error) {
    console.error("Warehouses API error:", error);
    return NextResponse.json({ error: "Failed to fetch warehouses" }, { status: 500 });
  }
}
