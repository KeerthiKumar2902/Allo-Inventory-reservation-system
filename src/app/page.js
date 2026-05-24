"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/products")
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      });
  }, []);

  const handleReserve = async (productId, warehouseId) => {
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 })
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || "Failed to reserve item");
        return;
      }
      
      toast.success("Inventory successfully reserved!");
      router.push(`/reservation/${data.id}`);
    } catch (err) {
      toast.error("An unexpected error occurred during reservation");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-muted-foreground">
        Loading inventory data...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Available Products</h1>
        <p className="text-muted-foreground mt-2">
          Select a warehouse below to reserve a unit for checkout. 
          Your reservation will hold the inventory safely for 10 minutes.
        </p>
      </div>

      <div className="grid gap-6">
        {products.map(product => (
          <Card key={product.id}>
            <CardHeader className="bg-muted/30">
              <CardTitle className="flex items-baseline gap-3">
                {product.name} 
                <span className="text-sm font-normal text-muted-foreground tracking-widest uppercase">
                  {product.sku}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-muted-foreground">
                Inventory Locations
              </h3>
              <div className="flex flex-col gap-3">
                {product.warehouses.map(wh => {
                  const isAvailable = wh.availableStock > 0;
                  return (
                    <div key={wh.warehouseId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-md bg-white">
                      <div className="mb-4 sm:mb-0">
                        <p className="font-medium text-lg">{wh.warehouse}</p>
                        <p className="text-sm text-muted-foreground">{wh.location}</p>
                      </div>
                      
                      <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <p className={`font-bold text-lg ${isAvailable ? 'text-green-600' : 'text-red-500'}`}>
                            {wh.availableStock} Available
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {wh.totalStock} Total &middot; {wh.reservedStock} Reserved
                          </p>
                        </div>
                        <Button 
                          disabled={!isAvailable}
                          onClick={() => handleReserve(product.id, wh.warehouseId)}
                          className={!isAvailable ? "opacity-50" : ""}
                        >
                          {isAvailable ? "Reserve" : "Out of Stock"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
