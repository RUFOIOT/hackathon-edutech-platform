"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface EnlaceNav {
  href: string;
  texto: string;
  /** Enlace a la plataforma (otra app en el sitio estático): se navega con <a>, no con el router. */
  externo?: boolean;
}

export interface SeccionPortada {
  id: string;
  texto: string;
}

// Rutas de la plataforma donde invitar a inscribirse no aporta (ya está dentro o en el formulario).
const SIN_CTA = ["/registro", "/ingresar", "/auth", "/mi-equipo", "/admin", "/jurado", "/pantalla", "/sin-acceso"];

const enlaceNav = "underline-offset-4 hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline";
const botonCta = "rounded-full bg-accent px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-on-accent transition hover:brightness-105";

/**
 * Encabezado fijo del sitio. Se compacta y gana sombra al hacer scroll; en pantallas angostas
 * deja logo, inscripción y un botón "Menú" que abre los enlaces en un popover nativo. En la
 * portada suma una fila con las secciones y marca la que se está leyendo.
 */
export function Encabezado({
  logo,
  enlaces,
  secciones,
  registro,
  ingresar,
  cierreInscripcionesIso,
}: {
  logo: string;
  enlaces: EnlaceNav[];
  secciones: SeccionPortada[];
  /** Enlace de inscripción; `null` si las inscripciones no están disponibles aquí. */
  registro: string | null;
  ingresar: string | null;
  cierreInscripcionesIso: string;
}) {
  // En el sitio estático las rutas terminan en "/" (trailingSlash).
  const ruta = (usePathname() ?? "/").replace(/\/$/, "") || "/";
  const enPortada = ruta === "/";
  const [compacto, setCompacto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cerradas, setCerradas] = useState(false);
  const [activa, setActiva] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLUListElement>(null);

  // Avisa al script en línea de app/layout.tsx que la página se hidrató (revelado a prueba de fallos).
  useEffect(() => {
    document.documentElement.dataset.hidratado = "true";
  }, []);

  useEffect(() => {
    const alDesplazar = () => setCompacto(window.scrollY > 12);
    alDesplazar();
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => window.removeEventListener("scroll", alDesplazar);
  }, []);

  // El HTML puede venir de caché: pasado el cierre, el botón de inscripción se retira en el navegador.
  useEffect(() => {
    const falta = new Date(cierreInscripcionesIso).getTime() - Date.now();
    if (falta <= 0) {
      setCerradas(true);
      return;
    }
    // setTimeout no admite esperas de más de ~24 días.
    if (falta > 2_000_000_000) return;
    const id = window.setTimeout(() => setCerradas(true), falta);
    return () => window.clearTimeout(id);
  }, [cierreInscripcionesIso]);

  // Estado del popover para aria-expanded; se cierra al cambiar de página o al pasar a escritorio.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const alAlternar = (e: Event) => setMenuAbierto((e as ToggleEvent).newState === "open");
    el.addEventListener("toggle", alAlternar);
    const escritorio = window.matchMedia("(min-width: 64rem)");
    const cerrar = () => cerrarMenu(el);
    escritorio.addEventListener("change", cerrar);
    return () => {
      el.removeEventListener("toggle", alAlternar);
      escritorio.removeEventListener("change", cerrar);
    };
  }, []);
  useEffect(() => {
    if (panel.current) cerrarMenu(panel.current);
  }, [ruta]);

  // Sección activa de la portada: la que cruza una franja bajo el encabezado.
  useEffect(() => {
    if (!enPortada || typeof IntersectionObserver === "undefined") return;
    const visibles = new Set<string>();
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          const id = (e.target as HTMLElement).dataset.seccion!;
          if (e.isIntersecting) visibles.add(id);
          else visibles.delete(id);
        }
        setActiva(secciones.find((s) => visibles.has(s.id))?.id ?? null);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    for (const s of secciones) {
      const seccion = document.getElementById(s.id)?.closest("section");
      if (!seccion) continue;
      seccion.dataset.seccion = s.id;
      io.observe(seccion);
    }
    return () => {
      io.disconnect();
      setActiva(null);
    };
  }, [enPortada, secciones]);

  // Mantiene a la vista el enlace activo dentro de la fila (sin interrumpir el scroll de la página).
  useEffect(() => {
    const fila = chips.current;
    const chip = fila?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!fila || !chip) return;
    fila.scrollLeft = chip.offsetLeft - (fila.clientWidth - chip.offsetWidth) / 2;
  }, [activa]);

  const cta = registro && !cerradas && !SIN_CTA.some((r) => ruta === r || ruta.startsWith(`${r}/`)) ? registro : null;
  const actual = (href: string) => (ruta === href || ruta.startsWith(`${href}/`) ? "page" : undefined);

  const enlace = (e: EnlaceNav, clase: string, alHacerClic?: () => void) =>
    e.externo ? (
      <a href={e.href} className={clase}>
        {e.texto}
      </a>
    ) : (
      <Link href={e.href} aria-current={actual(e.href)} className={clase} onClick={alHacerClic}>
        {e.texto}
      </Link>
    );

  return (
    <header data-compacto={compacto} className="encabezado sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <nav aria-label="Principal" className="barra mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 px-4 lg:gap-x-6">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Inicio: Hackathon EduTech Eight Academy by n8n">
          <Image src={logo} alt="" width={507} height={125} className="h-7 w-auto rounded-lg sm:h-8" />
          <span className="hidden font-display text-lg font-semibold sm:inline">EduTech</span>
        </Link>

        <ul className="ml-auto hidden items-center gap-4 text-sm lg:flex">
          {enlaces.map((e) => (
            <li key={e.href}>{enlace(e, enlaceNav)}</li>
          ))}
          {ingresar && (
            <li>
              <a href={ingresar} className="rounded-full border border-fg/40 px-3 py-1.5 font-medium transition hover:bg-surface">
                Ingresar
              </a>
            </li>
          )}
        </ul>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {cta && (
            <a href={cta} className={botonCta}>
              {/* A 360 px no cabe la frase completa junto al logo y el botón del menú. */}
              <span className="min-[26rem]:hidden">Inscribirme</span>
              <span className="hidden min-[26rem]:inline">Inscribir a mi equipo</span>
            </a>
          )}
          <button
            type="button"
            popoverTarget="menu-principal"
            aria-controls="menu-principal"
            aria-expanded={menuAbierto}
            className="menu-boton items-center gap-2 rounded-full border border-fg/40 px-3 py-1.5 text-sm font-medium lg:hidden!"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
            Menú
          </button>
        </div>

        <div ref={panel} id="menu-principal" popover="auto" className="menu-panel basis-full px-4 pb-6 pt-3 lg:hidden!">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-semibold">Menú</p>
            <button
              type="button"
              popoverTarget="menu-principal"
              popoverTargetAction="hide"
              className="menu-cerrar items-center rounded-full border border-fg/40 px-3 py-1.5 text-sm font-medium"
            >
              Cerrar<span className="sr-only"> menú</span>
            </button>
          </div>
          <ul className="mt-3 grid">
            {enlaces.map((e) => (
              <li key={e.href} className="border-b border-border">
                {enlace(e, `block py-3 ${enlaceNav}`, () => panel.current && cerrarMenu(panel.current))}
              </li>
            ))}
          </ul>
          {ingresar && (
            <a href={ingresar} className="mt-5 block rounded-full border border-fg/40 px-4 py-2.5 text-center font-medium">
              Ingresar
            </a>
          )}
        </div>
      </nav>

      {enPortada && secciones.length > 0 && (
        <nav aria-label="Secciones de esta página" className="nav-secciones border-t border-border/60">
          <ul ref={chips} className="mx-auto flex h-10 max-w-6xl items-center gap-2 overflow-x-auto px-4 text-sm">
            {secciones.map((s) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  aria-current={activa === s.id ? "location" : undefined}
                  className="block rounded-full px-3 py-1 whitespace-nowrap text-muted transition-colors hover:text-fg aria-[current=location]:bg-fg aria-[current=location]:font-medium aria-[current=location]:text-bg"
                >
                  {s.texto}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

/** Cierra el popover si está abierto (y si el navegador lo soporta). */
function cerrarMenu(el: HTMLElement) {
  try {
    if (el.matches(":popover-open")) el.hidePopover();
  } catch {
    // Navegador sin popover: el panel es parte del encabezado y no hay nada que cerrar.
  }
}
