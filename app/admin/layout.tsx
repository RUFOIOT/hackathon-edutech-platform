import { requireSesion } from "@/lib/auth/session";
import { FASES, faseActual } from "@/lib/event/phase";
import { BotonSalir } from "@/components/boton-salir";

/** Barra superior del dashboard: fase actual del evento calculada desde config/event.ts. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSesion("/admin");
  const actual = faseActual();
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
      {children}
    </div>
  );
}
