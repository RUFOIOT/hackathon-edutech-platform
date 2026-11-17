import { EVENT, fecha } from "@/config/event";

export type Categoria = "JUNIOR" | "OPEN";

/**
 * Edad cumplida en una fecha de referencia. `nacimiento` es YYYY-MM-DD (fecha civil, sin hora),
 * por eso se compara componente a componente y no con milisegundos.
 */
export function edadEn(nacimiento: string, referencia: Date): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nacimiento);
  if (!m) throw new Error("Fecha de nacimiento inválida: usa el formato AAAA-MM-DD.");
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Fecha civil de la referencia en Ecuador (UTC-5 fijo).
  const ref = new Date(referencia.getTime() - 5 * 60 * 60 * 1000);
  let edad = ref.getUTCFullYear() - anio;
  const antesDelCumple = ref.getUTCMonth() + 1 < mes || (ref.getUTCMonth() + 1 === mes && ref.getUTCDate() < dia);
  if (antesDelCumple) edad -= 1;
  return edad;
}

export type ResultadoCategoria = { ok: true; categoria: Categoria; edad: number } | { ok: false; edad: number; motivo: string };

/** La edad se mide al día del kick-off: es la que define la categoría en el evento. */
export function calcularCategoria(nacimiento: string, referencia: Date = fecha("kickoff")): ResultadoCategoria {
  const edad = edadEn(nacimiento, referencia);
  if (edad < EVENT.categorias.JUNIOR.edadMin) {
    return {
      ok: false,
      edad,
      motivo: `Para inscribirte necesitas tener al menos ${EVENT.categorias.JUNIOR.edadMin} años el día del evento.`,
    };
  }
  return { ok: true, edad, categoria: edad <= EVENT.categorias.JUNIOR.edadMax ? "JUNIOR" : "OPEN" };
}

/**
 * Los equipos son de una sola categoría (reunión de staff del 10 nov, D-47): nadie puede entrar a un
 * equipo que ya tiene integrantes de la otra. Devuelve el motivo del rechazo o null si se permite.
 */
export function motivoCategoriaIncompatible(
  conteo: Partial<Record<Categoria, number>> | undefined,
  categoria: Categoria,
): string | null {
  const otra: Categoria = categoria === "JUNIOR" ? "OPEN" : "JUNIOR";
  if ((conteo?.[otra] ?? 0) === 0) return null;
  const nombre = { JUNIOR: "Junior (14 a 17 años)", OPEN: "Open (18 años o más)" };
  return `Ese equipo es de la categoría ${nombre[otra]} y tú eres ${nombre[categoria]}: los equipos son de una sola categoría.`;
}

/** Categoría resultante del equipo: JUNIOR solo si todos sus integrantes son JUNIOR (rúbrica §7). */
export function categoriaEquipo(categorias: Categoria[]): "JUNIOR" | "OPEN" | "MIXTO" {
  if (categorias.length === 0) return "OPEN";
  if (categorias.every((c) => c === "JUNIOR")) return "JUNIOR";
  if (categorias.every((c) => c === "OPEN")) return "OPEN";
  return "MIXTO";
}
