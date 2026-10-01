import { fecha } from "@/config/event";

/** Fases del evento que muestra la barra superior del dashboard 360. */
export const FASES = ["Convocatoria", "Pre-evento", "Hacking", "Code freeze", "Show and Tell", "Resultados"] as const;
export type Fase = (typeof FASES)[number];

/**
 * Calcula la fase a partir de las fechas de config/event.ts.
 *
 * - Convocatoria: hasta el cierre de inscripciones.
 * - Pre-evento: del cierre al kick-off.
 * - Hacking: kick-off → code freeze.
 * - Code freeze: code freeze → inicio del Show and Tell (validación de repositorios).
 * - Show and Tell: semifinal y final, hasta la premiación.
 * - Resultados: desde la premiación.
 */
export function faseActual(ahora: Date = new Date()): Fase {
  const t = ahora.getTime();
  if (t < fecha("cierreInscripciones").getTime()) return "Convocatoria";
  if (t < fecha("kickoff").getTime()) return "Pre-evento";
  if (t < fecha("codeFreeze").getTime()) return "Hacking";
  if (t < fecha("showAndTell").getTime()) return "Code freeze";
  if (t < fecha("premiacion").getTime()) return "Show and Tell";
  return "Resultados";
}

/** Inscripciones abiertas: entre la apertura y el cierre configurados. */
export function inscripcionesAbiertas(ahora: Date = new Date()): boolean {
  const t = ahora.getTime();
  return t >= fecha("aperturaInscripciones").getTime() && t < fecha("cierreInscripciones").getTime();
}

/** Ventana oficial de hacking (guía §7.1). */
export function dentroDeVentana(ahora: Date = new Date()): boolean {
  const t = ahora.getTime();
  return t >= fecha("kickoff").getTime() && t < fecha("codeFreeze").getTime();
}
