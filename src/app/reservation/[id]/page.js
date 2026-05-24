"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ReservationPage() {
  const params = useParams();
  // In Next.js 15, params must be un-wrapped using React.use() if awaited, but in client components it can be accessed directly or wrapped in useEffect
  // Note: App Router client component `useParams()` returns `{ id: '...' }` safely.
  const id = params.id;
  
  const router = useRouter();
  const [reservation, setReservation] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchReservation = async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      const data = await res.json();
      setReservation(data);
    } catch (err) {
      toast.error("Failed to load reservation data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchReservation();
    }
  }, [id]);

  useEffect(() => {
    if (!reservation || reservation.status !== "PENDING") return;

    const updateTimer = () => {
      const now = new Date();
      const expires = new Date(reservation.expiresAt);
      const diff = Math.max(0, Math.floor((expires - now) / 1000));
      
      if (diff <= 0) {
        setTimeLeft("00:00");
        fetchReservation(); // refresh to show released status naturally
        clearInterval(interval);
      } else {
        const mins = String(Math.floor(diff / 60)).padStart(2, '0');
        const secs = String(diff % 60).padStart(2, '0');
        setTimeLeft(`${mins}:${secs}`);
      }
    };

    updateTimer(); // initial call
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [reservation]);

  const handleAction = async (action) => {
    try {
      const res = await fetch(`/api/reservations/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || `Failed to ${action}`);
        // Refresh to get actual status if backend rejected transition
        fetchReservation(); 
        return;
      }
      
      toast.success(action === 'confirm' ? 'Purchase successfully confirmed!' : 'Reservation cancelled successfully.');
      fetchReservation();
    } catch (err) {
      toast.error("An unexpected error occurred processing your request");
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen text-muted-foreground">Loading checkout...</div>;
  }

  if (!reservation || reservation.error) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Reservation Not Found</h1>
        <Button onClick={() => router.push('/')}>Return to Products</Button>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  
  return (
    <div className="max-w-3xl mx-auto p-8 pt-16">
      <Card className="shadow-lg border-muted">
        <CardHeader className="bg-zinc-50 border-b">
          <CardTitle className="text-2xl flex justify-between items-center">
            Checkout Details
            <span className={`text-sm px-3 py-1 rounded-full border tracking-wide font-semibold ${
              isConfirmed ? 'bg-green-100 text-green-700 border-green-200' :
              reservation.status === 'RELEASED' ? 'bg-red-100 text-red-700 border-red-200' : 
              'bg-blue-100 text-blue-700 border-blue-200'
            }`}>
              {reservation.status}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-lg border">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Product</p>
              <p className="font-semibold text-lg">{reservation.product.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Warehouse</p>
              <p className="font-semibold text-lg">{reservation.warehouse.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Quantity Reserved</p>
              <p className="font-semibold text-lg">{reservation.quantity} Unit</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Reservation ID</p>
              <p className="font-mono text-sm text-muted-foreground truncate">{reservation.id}</p>
            </div>
          </div>

          {isPending && (
            <div className="bg-red-50/50 border border-red-100 p-6 rounded-lg text-center shadow-inner">
              <p className="text-sm font-semibold text-red-800 uppercase tracking-wider mb-2">
                Time remaining to complete purchase
              </p>
              <p className="text-5xl font-mono font-bold text-red-600 tracking-tight">
                {timeLeft || "00:00"}
              </p>
              <p className="text-xs text-red-600/70 mt-3 max-w-sm mx-auto">
                Inventory is temporarily held for you. If time expires, it will be automatically released to other customers.
              </p>
            </div>
          )}
          
          {isConfirmed && (
            <div className="bg-green-50 border border-green-100 p-6 rounded-lg text-center">
              <h2 className="text-xl font-bold text-green-800 mb-2">Order Confirmed!</h2>
              <p className="text-green-700 text-sm">Your inventory has been permanently secured and deducted from our warehouse.</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 bg-zinc-50 border-t p-6">
          <Button variant="outline" onClick={() => router.push('/')} className="w-full sm:w-auto">
            {isPending ? 'Browse More' : 'Return to Store'}
          </Button>
          
          {isPending && (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button variant="destructive" className="w-full sm:w-auto" onClick={() => handleAction('release')}>
                Cancel Order
              </Button>
              <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-md" onClick={() => handleAction('confirm')}>
                Confirm Purchase
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
