"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { clientDb } from "@/lib/firebase/client";
import { restante } from "@/lib/event/countdown";

interface Cronometro {
  sala: string;
  equipo: string;
  orden: number;
  corriendo: boolean;
  inicioMs: number | null;
  acumuladoMs: number;
}

const dos = (n: number) => String(n).padStart(2, "0");

/**
 * Fase del Show and Tell según el tiempo transcurrido (Guía del Hacker §7). Sobre fondo navy se
 * usan las variantes claras de los tokens para mantener contraste AA; el texto dice la fase.
 */
function faseShowAndTell(segundos: number, minutosExposicion: number, minutosTotal: number) {
  if (segundos >= minutosTotal * 60) return { texto: "Tiempo cumplido: se apaga el micrófono", color: "text-[#ec7a64]" };
  if (segundos >= minutosExposicion * 60) return { texto: "Preguntas del jurado", color: "text-[#d8ad62]" };
  return { texto: "Exposición y demo en vivo", color: "text-[#4cc2c2]" };
}

export function Proyector({
  sala,
  freezeIso,
  showAndTellIso,
  minutosExposicion,
  minutosTotal,
}: {
  sala: string | null;
  freezeIso: string;
  showAndTellIso: string;
  minutosExposicion: number;
  minutosTotal: number;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [crono, setCrono] = useState<Cronometro | null>(null);
  const [ahora, setAhora] = useState<number | null>(null);

  useEffect(() => {
    setAhora(Date.now());
    const id = window.setInterval(() => setAhora(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const db = clientDb();
    const cancelar = [onSnapshot(doc(db, "public_state/pantalla"), (s) => setAviso((s.get("aviso") as string | null) ?? null))];
    if (sala) cancelar.push(onSnapshot(doc(db, `public_state/cronometro_${sala}`), (s) => setCrono(s.exists() ? (s.data() as Cronometro) : null)));
    return () => cancelar.forEach((f) => f());
  }, [sala]);

  const transcurridoSeg =
    crono && ahora !== null ? Math.floor((crono.acumuladoMs + (crono.corriendo && crono.inicioMs ? ahora - crono.inicioMs : 0)) / 1000) : 0;
  const freeze = new Date(freezeIso);
  const r = ahora !== null ? restante(freeze, new Date(ahora)) : null;
  const antesDelFreeze = ahora !== null && ahora < freeze.getTime();
  const fase = faseShowAndTell(transcurridoSeg, minutosExposicion, minutosTotal);

  return (
    // Ocupa toda la pantalla (sobre el header y el footer del sitio): es la vista del proyector.
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 overflow-auto bg-navy-900 px-6 py-10 text-center text-paper-50">
      {aviso && (
        <p role="status" className="max-w-5xl rounded border-2 border-brass-500 px-6 py-4 text-2xl font-semibold sm:text-4xl">
          {aviso}
        </p>
      )}

      {crono?.equipo ? (
        <div>
          <p className="text-xl text-paper-50/80 sm:text-2xl">
            {crono.sala} · turno {crono.orden}
          </p>
          <h1 className="mt-2 text-4xl font-semibold sm:text-6xl">{crono.equipo}</h1>
          <p className="mt-6 font-display text-[clamp(5rem,22vw,16rem)] leading-none tabular-nums">
            {dos(Math.floor(transcurridoSeg / 60))}:{dos(transcurridoSeg % 60)}
          </p>
          <p className={`mt-4 text-2xl font-semibold sm:text-4xl ${fase.color}`}>{fase.texto}</p>
          <p className="mt-2 text-lg text-paper-50/80">
            {minutosExposicion} min de exposición · {minutosTotal - minutosExposicion} min de preguntas · {crono.corriendo ? "en curso" : "en pausa"}
          </p>
        </div>
      ) : antesDelFreeze && r ? (
        <div>
          <h1 className="text-3xl font-semibold sm:text-5xl">Code freeze</h1>
          <p className="mt-4 font-display text-[clamp(4rem,16vw,12rem)] leading-none tabular-nums">
            {r.dias > 0 ? `${r.dias}d ` : ""}
            {dos(r.horas)}:{dos(r.minutos)}:{dos(r.segundos)}
          </p>
          <p className="mt-4 text-xl text-paper-50/80">Sábado 12:00 · tag entrega y formulario de entrega</p>
        </div>
      ) : (
        <div>
          <h1 className="text-3xl font-semibold sm:text-5xl">Show and Tell</h1>
          <p className="mt-4 text-xl text-paper-50/80">
            {ahora !== null && ahora < new Date(showAndTellIso).getTime() ? "Comienza a las 13:30." : "Esperando al siguiente equipo."}
          </p>
        </div>
      )}
    </div>
  );
}
