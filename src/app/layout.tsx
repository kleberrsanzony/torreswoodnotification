import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Hammer, Package } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Toaster } from "sonner";
import PWAManager from "@/components/PWAManager";

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
      <body className={`${inter.className} min-h-screen bg-background text-foreground transition-colors duration-300`}>
        <ThemeProvider>
          <header className="bg-card/95 backdrop-blur-md border-b sticky top-0 z-50">
            <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
              <h1 className="font-black text-lg tracking-tighter flex items-center gap-2">
                <Hammer className="w-5 h-5 text-primary" />
                <span className="hidden xs:inline">Torres Notifica</span>
                <span className="xs:hidden uppercase text-[10px] tracking-widest font-black">Torres</span>
              </h1>
              <div className="flex items-center gap-3">
                <nav className="flex items-center gap-3 text-xs font-black uppercase tracking-widest">
                  <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                    Venda
                  </Link>
                  <Link href="/estoque" className="text-muted-foreground hover:text-foreground transition-colors">
                    Estoque
                  </Link>
                </nav>
                <div className="w-px h-6 bg-border mx-1 opacity-50" />
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="max-w-md w-full mx-auto p-4 flex flex-col flex-grow pb-10">
            {children}
            <footer className="w-full pt-10 pb-12 mt-10 text-center border-t border-border opacity-60">
              <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase">
                DESENVOLVIDO POR <span className="text-primary">SANZONY TECH™</span> &copy; {new Date().getFullYear()}
              </p>
            </footer>
          </main>

          <Toaster position="top-center" richColors />
          <PWAManager />
        </ThemeProvider>
      </body>
    </html>
  );
}
