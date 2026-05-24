import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata = {
  title: "Allo Store | Inventory Reservation",
  description: "Concurrency-safe inventory reservation demo",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
