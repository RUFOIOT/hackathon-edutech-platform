import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { EVENT } from "@/config/event";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], axes: ["opsz"], variable: "--font-fraunces", display: "swap" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: EVENT.nombre, template: `%s · ${EVENT.nombre}` },
  description: "Construye en vivo soluciones para la educación. 6 y 7 de noviembre de 2026, Quito.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1B3D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-EC" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:bg-surface focus:p-2">
          Saltar al contenido
        </a>
        <header className="border-b border-border">
          <nav aria-label="Principal" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-display text-lg font-semibold">
              EduTech Eight Academy
            </Link>
            <ul className="ml-auto flex flex-wrap gap-4 text-sm">
              <li><Link href="/tracks" className="underline-offset-4 hover:underline">Tracks</Link></li>
              <li><Link href="/guia" className="underline-offset-4 hover:underline">Guía</Link></li>
              <li><Link href="/rubrica" className="underline-offset-4 hover:underline">Rúbrica</Link></li>
              <li><Link href="/ingresar" className="underline-offset-4 hover:underline">Ingresar</Link></li>
            </ul>
          </nav>
        </header>
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border px-4 py-6 text-sm text-muted">
          <div className="mx-auto max-w-6xl">{EVENT.organiza}</div>
        </footer>
      </body>
    </html>
  );
}
