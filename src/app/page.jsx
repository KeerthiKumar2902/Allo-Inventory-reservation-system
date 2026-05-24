"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, MapPin, Pill, AlertCircle } from "lucide-react";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState(null);
  const router = useRouter();

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProducts();
  }, []);

  const handleReserve = async (productId, warehouseId) => {
    if (reservingId) return; 
    
    setReservingId(`${productId}-${warehouseId}`);
    
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
          toast.error(data.error || "Stock unavailable. Another pharmacy may have just reserved the last batch.");
          fetchProducts();
        } else {
          toast.error(data.error || "Failed to reserve item");
        }
        return;
      }
      
      toast.success("Medical supplies successfully reserved!");
      
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
      <div className="flex flex-col justify-center items-center h-[80vh] text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-teal-500" />
        <p className="font-medium tracking-wide">Connecting to pharmacy datastores...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 pt-10">
      <div className="mb-12 text-center md:text-left animate-in slide-in-from-bottom-4 duration-500 fade-in">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
          Clinical Inventory
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl leading-relaxed">
          Essential medical supplies and pharmaceuticals across our regional depots. 
          Real-time inventory locks mathematically guaranteed by PostgreSQL.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {products.map((product, index) => (
          <Card 
            key={product.id} 
            className="overflow-hidden border border-slate-100 shadow-lg shadow-slate-200/40 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 bg-white rounded-3xl animate-in slide-in-from-bottom-8 fade-in flex flex-col"
            style={{ animationDelay: `${index * 100}ms`, animationFillMode: "both" }}
          >
            <div className="h-48 relative bg-slate-50 flex items-center justify-center p-4 border-b border-slate-100">
               {product.imageUrl ? (
                 <div className="relative w-full h-full flex items-center justify-center">
                    <img 
                      src={product.imageUrl} 
                      alt={product.name}
                      className="max-h-full max-w-full object-cover drop-shadow-md p-2 hover:scale-105 transition-transform duration-500 rounded-lg"
                    />
                 </div>
               ) : (
                 <Pill className="w-20 h-20 text-slate-200" />
               )}
               <Badge className="absolute top-4 right-4 bg-teal-100/80 text-teal-800 hover:bg-teal-200 border-teal-200 backdrop-blur-md shadow-sm font-bold tracking-wider z-10">
                 SKU: {product.sku}
               </Badge>
            </div>
            
            <CardContent className="p-6 flex-1 flex flex-col">
              <div className="mb-6 flex-1">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-2 leading-tight">
                  {product.name}
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed line-clamp-3">
                  {product.description}
                </p>
              </div>

              {/* Idea A: The Modal Approach */}
              <div className="mt-auto border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center mb-4 px-1">
                  <span className="text-sm font-semibold text-slate-500">Total Network Stock</span>
                  <span className="text-sm font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                    {product.warehouses.reduce((sum, wh) => sum + (wh.availableStock > 0 ? wh.availableStock : 0), 0)} Units
                  </span>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-md rounded-xl h-11 text-base font-semibold transition-all">
                      Check Availability
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-xl bg-white rounded-3xl p-6">
                    <DialogHeader className="mb-4">
                      <DialogTitle className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <MapPin className="w-6 h-6 text-teal-600" />
                        {product.name}
                      </DialogTitle>
                      <DialogDescription className="text-slate-500 text-base">
                        Select a regional medical depot below to reserve inventory.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                      {product.warehouses.map(wh => {
                        const isAvailable = wh.availableStock > 0;
                        const isLoading = reservingId === `${product.id}-${wh.warehouseId}`;
                        
                        return (
                          <div key={wh.warehouseId} className={`flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl border ${isAvailable ? 'bg-slate-50/50 border-slate-200 hover:border-teal-200 hover:bg-teal-50/50' : 'bg-red-50/50 border-red-100'} transition-colors duration-200 group`}>
                            <div className="mb-3 sm:mb-0 w-full sm:w-auto text-left">
                              <p className="font-bold text-slate-800 text-lg">{wh.warehouse}</p>
                              <p className="text-sm text-slate-500 mt-0.5">{wh.location}</p>
                            </div>
                            
                            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                              <div className="text-right">
                                <p className={`font-black text-2xl tracking-tight ${isAvailable ? 'text-teal-600' : 'text-red-500'}`}>
                                  {wh.availableStock}
                                </p>
                                <p className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">In Stock</p>
                              </div>
                              <Button 
                                size="lg"
                                disabled={!isAvailable || reservingId !== null}
                                onClick={() => handleReserve(product.id, wh.warehouseId)}
                                className={!isAvailable 
                                  ? "opacity-50 bg-slate-200 text-slate-500 rounded-xl w-[120px]" 
                                  : "bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-200 rounded-xl w-[120px] transition-transform active:scale-95"
                                }
                              >
                                {isLoading ? (
                                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Locking</>
                                ) : isAvailable ? (
                                  "Reserve"
                                ) : (
                                  "Empty"
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
