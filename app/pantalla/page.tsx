import type { Metadata } from "next";
import { EVENT } from "@/config/event";
import { Proyector } from "./proyector";

export const metadata: Metadata = { title: "Pantalla" };

/**
 * Vista para proyector: cuenta regresiva al code freeze, cronómetro del Show and Tell de la sala
 * (?sala=sala-1) y avisos. Se actualiza en tiempo real desde public_state (lectura pública).
 */
export default async function Pantalla({ searchParams }: { searchParams: Promise<{ sala?: string }> }) {
  const { sala } = await searchParams;
  return (
    <Proyector
      sala={sala && /^[a-z0-9-]{1,30}$/.test(sala) ? sala : null}
      freezeIso={EVENT.fechas.codeFreeze.iso}
      showAndTellIso={EVENT.fechas.showAndTell.iso}
      minutosExposicion={EVENT.showAndTell.minutosExposicion}
      minutosTotal={EVENT.showAndTell.minutosExposicion + EVENT.showAndTell.minutosPreguntas}
    />
  );
}
