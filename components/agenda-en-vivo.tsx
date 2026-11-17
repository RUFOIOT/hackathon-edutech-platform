"use client";

import { useEffect, useState } from "react";
import { Revelar } from "@/components/revelar";
import { estadoAgenda, type BloqueAgenda, type EstadoAgenda } from "@/lib/event/agenda";

const DIAS = ["Viernes 27", "Sábado 28"] as const;

/**
 * Agenda del evento. Durante el 27 y 28 de noviembre resalta el bloque en curso ("Ahora") y el
 * que sigue, con el reloj del navegador (resta de instantes: no depende de su zona horaria).
 * Fuera del evento, y en el HTML del servidor, se ve como una agenda normal.
 */
export function AgendaEnVivo({ bloques }: { bloques: BloqueAgenda[] }) {
  const [estado, setEstado] = useState<EstadoAgenda>({ actual: null, siguiente: null });

  useEffect(() => {
    const fin = new Date(bloques[bloques.length - 1]?.finIso ?? 0).getTime();
    let id = 0;
    const tick = () => {
      const e = estadoAgenda(bloques, new Date());
      setEstado((previo) => (previo.actual === e.actual && previo.siguiente === e.siguiente ? previo : e));
      // Terminado el evento ya no hay nada que actualizar.
      if (Date.now() >= fin) window.clearInterval(id);
    };
    id = window.setInterval(tick, 30_000);
    tick();
    return () => window.clearInterval(id);
  }, [bloques]);

  return (
    <div className="mt-10 grid gap-12 md:grid-cols-2">
      {DIAS.map((dia, d) => (
        <Revelar key={dia} variante={d === 0 ? "izquierda" : "derecha"}>
          <h3 className="text-xl font-semibold">{dia} de noviembre</h3>
          <ol className="relative mt-6 grid gap-5 border-l-2 border-border pl-6">
            {bloques.map((a, i) => {
              if (a.dia !== dia) return null;
              const ahora = estado.actual === i;
              const sigue = estado.siguiente === i;
              return (
                <li
                  key={a.inicioIso}
                  aria-current={ahora ? "time" : undefined}
                  className={`relative rounded-lg ${ahora ? "bg-[color-mix(in_srgb,var(--color-ocho-ambar)_16%,transparent)] shadow-[0_0_0_8px_color-mix(in_srgb,var(--color-ocho-ambar)_16%,transparent)]" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[33px] top-1 h-4 w-4 rounded-full border-2 border-bg ${
                      ahora ? "punto-ahora bg-n8n" : a.hito ? "bg-ocho-ambar ring-4 ring-ocho-ambar/25" : "bg-ocho-azul"
                    }`}
                  />
                  <time dateTime={a.inicioIso} className="text-sm font-semibold tabular-nums text-muted">
                    {a.hora}
                  </time>
                  {ahora && <span className="ml-2 rounded-full bg-fg px-2 py-0.5 text-xs font-semibold text-bg">Ahora</span>}
                  {sigue && <span className="ml-2 rounded-full border border-muted px-2 py-0.5 text-xs font-medium text-muted">Sigue</span>}
                  <p className={a.hito || ahora ? "font-semibold" : ""}>{a.bloque}</p>
                </li>
              );
            })}
          </ol>
        </Revelar>
      ))}
    </div>
  );
}
