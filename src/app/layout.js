import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata = {
  title: "Inventory Reservation System",
  description: "Concurrency-safe inventory reservation demo",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased bg-zinc-50 min-h-screen">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
