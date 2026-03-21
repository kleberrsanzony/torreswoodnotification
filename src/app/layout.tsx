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
        <header className="bg-white/95 backdrop-blur-md border-b border-border sticky top-0 z-50">
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

        <main className="max-w-md w-full mx-auto p-4 flex flex-col flex-grow">
          {children}
        </main>

        <footer className="w-full py-5 text-center border-t border-slate-200" style={{ marginTop: 'auto' }}>
          <p className="text-[11px] font-medium text-slate-400 tracking-wider">
            DESENVOLVIDO POR <span className="text-blue-600 font-semibold">SANZONY TECH™</span> &copy; {new Date().getFullYear()}
          </p>
        </footer>

        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
