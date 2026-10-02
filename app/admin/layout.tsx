import Link from "next/link";
import { puedeEntrarAdmin } from "@/lib/auth/roles";
import { requireSesion } from "@/lib/auth/session";
import { FASES, faseActual } from "@/lib/event/phase";
import { ahora } from "@/lib/event/reloj";
import { BotonSalir } from "@/components/boton-salir";

/** Barra superior del dashboard: fase actual del evento calculada desde config/event.ts. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const id = await requireSesion("/admin");
  const secciones = [
    { href: "/admin", nombre: "Dashboard" },
    { href: "/admin/participantes", nombre: "Participantes" },
    { href: "/admin/equipos", nombre: "Equipos" },
    { href: "/admin/repositorios", nombre: "Repositorios" },
    { href: "/admin/checkin", nombre: "Check-in" },
    { href: "/admin/mentoria", nombre: "Mentoría" },
    { href: "/admin/jurado", nombre: "Jurado y salas" },
    { href: "/admin/resultados", nombre: "Resultados" },
    { href: "/admin/comunicados", nombre: "Comunicados" },
    { href: "/admin/auditoria", nombre: "Auditoría" },
    { href: "/admin/privacidad", nombre: "Privacidad" },
  ].filter((s) => puedeEntrarAdmin(id, s.href));
  const actual = faseActual(ahora());
  return (
    <div>
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-2">
          <ol aria-label="Fase del evento" className="flex flex-wrap gap-1 text-sm">
            {FASES.map((f, i) => (
              <li
                key={f}
                aria-current={f === actual ? "step" : undefined}
                className={f === actual ? "rounded bg-navy-900 px-2 py-1 font-medium text-paper-50" : "px-2 py-1 text-muted"}
              >
                {i + 1}. {f}
              </li>
            ))}
          </ol>
          <div className="ml-auto">
            <BotonSalir />
          </div>
        </div>
      </div>
      <nav aria-label="Secciones de administración" className="border-b border-border">
        <ul className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-1 px-4 py-2 text-sm">
          {secciones.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="underline-offset-4 hover:underline">
                {s.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
