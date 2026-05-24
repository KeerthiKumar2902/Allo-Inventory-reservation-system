import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db.js';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        inventories: {
          include: {
            warehouse: true,
          }
        }
      }
    });

    // Map to the requested shape, calculating availableStock dynamically
    const response = products.map(product => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      warehouses: product.inventories.map(inv => ({
        warehouse: inv.warehouse.name,
        location: inv.warehouse.location,
        totalStock: inv.totalStock,
        reservedStock: inv.reservedStock,
        // Available is purely derived here, not stored directly
        availableStock: inv.totalStock - inv.reservedStock
      }))
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
