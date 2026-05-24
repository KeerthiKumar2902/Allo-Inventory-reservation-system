"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState(null); // Track which warehouse button is loading
  const [activeIds, setActiveIds] = useState([]); // Track active cart sessions
  const router = useRouter();

  useEffect(() => {
    fetchProducts();
    // Load any active reservations from localStorage so the user doesn't lose them
    const storedIds = JSON.parse(localStorage.getItem('activeReservationIds') || "[]");
    setActiveIds(storedIds);
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load inventory");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      toast.error("Network error: Could not load products from server");
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (productId, warehouseId) => {
    if (reservingId) return; // Prevent double clicks
    
    setReservingId(warehouseId);
    
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID()
        },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 })
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 409) {
          toast.error(data.error || "Stock unavailable. Another customer may have just reserved the last item.");
          fetchProducts(); // Force a reactive update to sync the new 0 stock state
        } else {
          toast.error(data.error || "Failed to reserve item");
        }
        return;
      }
      
      toast.success("Inventory successfully reserved!");
      
      // Save the new reservation ID to localStorage so we don't lose the cart
      const existing = JSON.parse(localStorage.getItem('activeReservationIds') || "[]");
      if (!existing.includes(data.id)) {
        existing.push(data.id);
        localStorage.setItem('activeReservationIds', JSON.stringify(existing));
      }

      router.push(`/reservation/${data.id}`);
    } catch (err) {
      toast.error("Network Error: An unexpected error occurred during reservation request.");
    } finally {
      setReservingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading real-time inventory...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      {activeIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-6 py-4 rounded-lg mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
          <div>
            <p className="font-bold flex items-center gap-2">🛒 You have {activeIds.length} active reservation(s) holding inventory!</p>
            <p className="text-sm opacity-80">Please complete your checkout before the timer expires.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeIds.map((id, index) => (
              <Button key={id} onClick={() => router.push(`/reservation/${id}`)} variant="outline" className="bg-white border-blue-200 hover:bg-blue-100 hover:text-blue-900">
                Resume Checkout {activeIds.length > 1 ? `#${index + 1}` : ''}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Available Products</h1>
        <p className="text-muted-foreground mt-2">
          Select a warehouse below to reserve a unit for checkout. 
          Your reservation will safely hold the inventory for 10 minutes.
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
                  const isLoading = reservingId === wh.warehouseId;
                  
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
                          disabled={!isAvailable || reservingId !== null}
                          onClick={() => handleReserve(product.id, wh.warehouseId)}
                          className={!isAvailable ? "opacity-50" : "w-[130px]"}
                        >
                          {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reserving</>
                          ) : isAvailable ? (
                            "Reserve Unit"
                          ) : (
                            "Out of Stock"
                          )}
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
