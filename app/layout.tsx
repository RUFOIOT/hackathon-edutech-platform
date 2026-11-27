import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Encabezado, type EnlaceNav, type SeccionPortada } from "@/components/encabezado";
import { EVENT, JURADO, MENTORES } from "@/config/event";
import { inscripcionesAbiertas, listaEsperaTardiaAbierta } from "@/lib/event/phase";
import { ahora } from "@/lib/event/reloj";
import { asset, enlacePlataforma } from "@/lib/sitio";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], axes: ["opsz"], variable: "--font-fraunces", display: "swap" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: EVENT.nombre, template: `%s · ${EVENT.nombre}` },
  description: "Construye en vivo soluciones para la educación. 27 y 28 de noviembre de 2026, Quito.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1B3D" },
  ],
};

/**
 * Marca <html> con la clase "js" antes de pintar: solo entonces globals.css oculta lo que se
 * revela al hacer scroll. Si la página no llega a hidratarse (el encabezado pone data-hidratado),
 * la clase se retira y todo el contenido queda a la vista. La CSP admite scripts en línea (D-42).
 */
const SCRIPT_JS = `(function(d){d.classList.add("js");setTimeout(function(){if(!d.hasAttribute("data-hidratado"))d.classList.remove("js")},5000)})(document.documentElement)`;

/** Secciones de la portada con ancla: el id es el del título de cada sección en app/page.tsx. */
const SECCIONES_PORTADA: SeccionPortada[] = [
  { id: "tracks", texto: "Tracks" },
  { id: "agenda", texto: "Agenda" },
  { id: "premios", texto: "Premios" },
  ...(MENTORES.length > 0 || JURADO.length > 0 ? [{ id: "personas", texto: "Mentores y jurado" }] : []),
  { id: "faq", texto: "FAQ" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const resultados = enlacePlataforma("/resultados");
  const enlaces: EnlaceNav[] = [
    { href: "/tracks", texto: "Tracks" },
    { href: "/guia", texto: "Guía" },
    { href: "/guia-hacker", texto: "Guía del hacker" },
    { href: "/rubrica", texto: "Rúbrica" },
    ...(resultados ? [{ href: resultados, texto: "Resultados", externo: true }] : []),
  ];

  return (
    // La clase "js" la agrega el script en línea: por eso <html> no avisa de diferencias al hidratar.
    <html lang="es-EC" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_JS }} />
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:bg-surface focus:p-2">
          Saltar al contenido
        </a>
        <Encabezado
          logo={asset("/brand/eight-academy-logo.png")}
          enlaces={enlaces}
          secciones={SECCIONES_PORTADA}
          registro={inscripcionesAbiertas(ahora()) || listaEsperaTardiaAbierta(ahora()) ? enlacePlataforma("/registro") : null}
          ingresar={enlacePlataforma("/ingresar")}
          cierreInscripcionesIso={EVENT.fechas.cierreInscripciones.iso}
        />
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
