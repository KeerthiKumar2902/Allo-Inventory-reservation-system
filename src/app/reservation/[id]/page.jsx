"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function ReservationPage() {
  const params = useParams();
  const id = params.id;
  
  const router = useRouter();
  const [reservation, setReservation] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null); // 'confirm' or 'release'

  const fetchReservation = async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setReservation(data);
    } catch (err) {
      toast.error("Network error: Failed to sync reservation data from server.");
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
        clearInterval(interval);
        
        // Expiry UI awareness: if the countdown runs out visually, transition state locally 
        // immediately rather than waiting for the server cron job to physically run.
        // This prevents the user from attempting invalid confirms.
        setReservation(prev => ({ ...prev, status: "RELEASED" }));
        toast.info("Your reservation expired and the inventory has been automatically released.");

        // Clear from active carts
        const existing = JSON.parse(localStorage.getItem('activeReservationIds') || "[]");
        const updated = existing.filter(resId => resId !== id);
        localStorage.setItem('activeReservationIds', JSON.stringify(updated));
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
    if (actioning) return; // Prevent double clicks during network flight
    setActioning(action);
    
    try {
      const res = await fetch(`/api/reservations/${id}/${action}`, { 
        method: "POST",
        headers: {
          "Idempotency-Key": crypto.randomUUID()
        }
      });
      const data = await res.json();
      
      if (!res.ok) {
        // Specific UI error handling explicitly required by phase 8
        if (res.status === 410) {
          toast.error("Reservation expired. The system can no longer process this checkout.");
        } else if (res.status === 409) {
          toast.error(data.error || "Conflict error processing request.");
        } else {
          toast.error(data.error || `Failed to ${action} reservation.`);
        }
        
        // Refresh to guarantee frontend stays synchronized with the database reality
        fetchReservation(); 
        return;
      }
      
      toast.success(action === 'confirm' ? 'Purchase successfully confirmed!' : 'Reservation cancelled successfully.');
      
      // Clear from active carts
      const existing = JSON.parse(localStorage.getItem('activeReservationIds') || "[]");
      const updated = existing.filter(resId => resId !== id);
      localStorage.setItem('activeReservationIds', JSON.stringify(updated));

      fetchReservation();
    } catch (err) {
      toast.error("Network Error: An unexpected issue occurred while contacting the server.");
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading checkout session...</p>
      </div>
    );
  }

  if (!reservation || reservation.error) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center mt-16">
        <h1 className="text-3xl font-bold mb-4 text-red-600">Session Not Found</h1>
        <p className="text-muted-foreground mb-8">We could not locate this reservation. It may have expired or never existed.</p>
        <Button onClick={() => router.push('/')}>Return to Products</Button>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";
  
  return (
    <div className="max-w-3xl mx-auto p-8 pt-16">
      <Card className="shadow-lg border-muted">
        <CardHeader className="bg-zinc-50 border-b">
          <CardTitle className="text-2xl flex justify-between items-center">
            Checkout Details
            <span className={`text-sm px-3 py-1 rounded-full border tracking-wide font-semibold ${
              isConfirmed ? 'bg-green-100 text-green-700 border-green-200' :
              isReleased ? 'bg-red-100 text-red-700 border-red-200' : 
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
            <div className="bg-red-50/50 border border-red-100 p-6 rounded-lg text-center shadow-inner transition-opacity">
              <p className="text-sm font-semibold text-red-800 uppercase tracking-wider mb-2">
                Time remaining to complete purchase
              </p>
              <p className="text-5xl font-mono font-bold text-red-600 tracking-tight">
                {timeLeft || "00:00"}
              </p>
              <p className="text-xs text-red-600/70 mt-3 max-w-sm mx-auto">
                Inventory is temporarily held for you. If time expires, it will automatically be returned to the shelf.
              </p>
            </div>
          )}
          
          {isConfirmed && (
            <div className="bg-green-50 border border-green-100 p-6 rounded-lg text-center animate-in fade-in zoom-in duration-300">
              <h2 className="text-xl font-bold text-green-800 mb-2">Order Confirmed!</h2>
              <p className="text-green-700 text-sm">Your inventory has been permanently secured and deducted from our warehouse.</p>
            </div>
          )}

          {isReleased && (
            <div className="bg-zinc-100 border border-zinc-200 p-6 rounded-lg text-center animate-in fade-in zoom-in duration-300">
              <h2 className="text-xl font-bold text-zinc-800 mb-2">Reservation Cancelled</h2>
              <p className="text-zinc-600 text-sm">This reservation has been released. The inventory is no longer held for you.</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 bg-zinc-50 border-t p-6">
          <Button variant="outline" onClick={() => router.push('/')} className="w-full sm:w-auto" disabled={actioning !== null}>
            {isPending ? 'Browse More' : 'Return to Store'}
          </Button>
          
          {isPending && (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button 
                variant="destructive" 
                className="w-full sm:w-auto" 
                disabled={actioning !== null}
                onClick={() => handleAction('release')}
              >
                {actioning === 'release' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelling...</> : 'Cancel Order'}
              </Button>
              <Button 
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-md" 
                disabled={actioning !== null}
                onClick={() => handleAction('confirm')}
              >
                {actioning === 'confirm' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : 'Confirm Purchase'}
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
