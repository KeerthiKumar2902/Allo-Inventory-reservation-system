"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [activeIds, setActiveIds] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkCart = () => {
      const stored = JSON.parse(localStorage.getItem('activeReservationIds') || "[]");
      setActiveIds(prev => {
        if (stored.length !== prev.length || JSON.stringify(stored) !== JSON.stringify(prev)) {
          return stored;
        }
        return prev;
      });
    };
    checkCart();
    const interval = setInterval(checkCart, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-teal-700 shadow-md">
      <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4 md:px-8">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" 
          onClick={() => router.push('/')}
        >
          <div className="h-9 w-9 bg-white text-teal-700 rounded-xl flex items-center justify-center font-black text-2xl shadow-sm">
            +
          </div>
          <span className="text-xl font-bold text-white tracking-tight hidden sm:block">Allo Pharmacy</span>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" className="text-teal-50 hover:bg-teal-600 hover:text-white" onClick={() => router.push('/')}>
            <Package className="w-4 h-4 mr-2" /> Products
          </Button>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="relative flex items-center gap-2 bg-teal-800 border-teal-600 text-white hover:bg-teal-900 hover:text-white transition-colors">
                <ShoppingCart className="h-4 w-4" />
                <span className="font-medium hidden sm:inline-block">Reservations</span>
                {activeIds.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full bg-rose-500 text-white p-0 text-xs font-bold border-2 border-teal-700 shadow-sm animate-in zoom-in duration-300">
                    {activeIds.length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="bg-slate-50 border-l sm:max-w-md">
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="h-6 w-6 text-teal-600" /> Active Reservations
                </SheetTitle>
                <SheetDescription className="text-slate-500">
                  These medical supplies are safely held for you. Please complete your checkout before the timer expires.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 overflow-y-auto h-[80vh] pb-8 pr-2">
                {activeIds.length === 0 ? (
                  <div className="text-center text-slate-400 p-8 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center gap-3">
                    <ShoppingCart className="h-10 w-10 opacity-20" />
                    <p>You have no active reservations.</p>
                  </div>
                ) : (
                  activeIds.map((id, index) => (
                    <div key={id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 relative overflow-hidden group hover:shadow-md transition-shadow">
                      <div className="absolute top-0 left-0 w-1 h-full bg-teal-500"></div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">Checkout Session #{index + 1}</span>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>
                      </div>
                      <p className="text-xs text-slate-400 font-mono truncate">{id}</p>
                      <Button 
                        onClick={() => {
                          setIsOpen(false);
                          router.push(`/reservation/${id}`);
                        }}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-200 rounded-xl mt-2"
                      >
                        Resume Checkout
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
