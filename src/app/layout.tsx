import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Hammer, Package } from "lucide-react";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Torres Madeira Notifica",
  description: "Sistema interno para comunicação entre vendedor e estoque.",
  manifest: "/manifest.ts",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <header className="bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b sticky top-0 z-50 shadow-sm">
          <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
            <h1 className="font-bold text-lg tracking-tight flex items-center gap-2">
              <Hammer className="w-5 h-5 text-primary" />
              Torres Notifica
            </h1>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                Nova Venda
              </Link>
              <Link href="/estoque" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <Package className="w-4 h-4" />
                Estoque
              </Link>
            </nav>
          </div>
        </header>
        
        <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col">
          {children}
        </main>
        
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
