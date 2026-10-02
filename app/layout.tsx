import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { EVENT } from "@/config/event";
import { asset, enlacePlataforma } from "@/lib/sitio";
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
        <header className="z-40 sm:sticky sm:top-0 border-b border-border bg-bg/85 backdrop-blur-md">
          <nav aria-label="Principal" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-3" aria-label="Inicio: Hackathon EduTech Eight Academy by n8n">
              <Image src={asset("/brand/eight-academy-logo.png")} alt="" width={507} height={125} className="h-8 w-auto rounded-lg" />
              <span className="font-display text-lg font-semibold">EduTech</span>
            </Link>
            <ul className="ml-auto flex flex-wrap items-center gap-4 text-sm">
              <li><Link href="/tracks" className="underline-offset-4 hover:underline">Tracks</Link></li>
              <li><Link href="/guia" className="underline-offset-4 hover:underline">Guía</Link></li>
              <li><Link href="/guia-hacker" className="underline-offset-4 hover:underline">Guía del hacker</Link></li>
              <li><Link href="/rubrica" className="underline-offset-4 hover:underline">Rúbrica</Link></li>
              {enlacePlataforma("/resultados") && <li><a href={enlacePlataforma("/resultados")!} className="underline-offset-4 hover:underline">Resultados</a></li>}
              {enlacePlataforma("/ingresar") && <li><a href={enlacePlataforma("/ingresar")!} className="rounded-full bg-accent px-3 py-1 font-medium text-on-accent">Ingresar</a></li>}
            </ul>
          </nav>
        </header>
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border px-4 py-6 text-sm text-muted">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
            <span>
              {EVENT.organiza} ·{" "}
              <Link href="/privacidad" className="underline underline-offset-4">
                Privacidad
              </Link>
            </span>
            <span className="flex items-center gap-2">
              Automatizaciones con
              <Image src={asset("/brand/n8n_full_black_logo.svg")} alt="n8n" width={60} height={20} unoptimized className="h-4 w-auto dark:hidden" />
              <Image src={asset("/brand/n8n_full_white_logo.svg")} alt="n8n" width={60} height={20} unoptimized className="hidden h-4 w-auto dark:block" />
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
