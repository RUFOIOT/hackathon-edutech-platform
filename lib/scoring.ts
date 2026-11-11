import { PREMIO } from "@/config/event";
import { RUBRICA, TOPE_C2_UNO, type CriterioCodigo } from "@/lib/models/rubrica";

/**
 * Cálculo de puntajes (rúbrica §4–§7). Funciones puras: las usan /admin/resultados, la
 * publicación y los tests. Equivalen a las funciones SQL score_total, room_normalization y
 * tiebreak del prompt (D-01). Desde la reunión de staff del 10 nov 2026 hay una sola ronda de
 * Show and Tell (2 salas, sin final): el ranking sale de los z-scores de esa ronda.
 */

export type Niveles = Record<"c1" | "c2" | "c3" | "c4" | "c5" | "c6", number>;

export interface PuntajeJuez extends Niveles {
  judgeId: string;
  teamId: string;
  tiempoUsadoSeg: number;
}

const CLAVE: Record<CriterioCodigo, keyof Niveles> = { C1: "c1", C2: "c2", C3: "c3", C4: "c4", C5: "c5", C6: "c6" };

function validarNiveles(n: Niveles) {
  // Solo c1..c6: el objeto puede traer más campos (judgeId, tiempoUsadoSeg…).
  for (const k of Object.values(CLAVE)) {
    const v = n[k];
    if (!Number.isInteger(v) || v < 1 || v > 5) throw new Error(`Nivel inválido en ${k}: ${v} (debe ser un entero de 1 a 5)`);
  }
}

/**
 * Puntaje de un juez sobre 100: Σ (nivel ÷ 5) × peso. Regla de no compensación: si C2 = 1,
 * el total no puede superar 60 (se aplica por juez, antes de promediar; D-05).
 */
export function scoreTotal(n: Niveles): number {
  validarNiveles(n);
  const total = RUBRICA.reduce((acc, c) => acc + (n[CLAVE[c.codigo]] / 5) * c.peso, 0);
  const redondeado = Math.round(total * 100) / 100;
  return n.c2 === 1 ? Math.min(redondeado, TOPE_C2_UNO) : redondeado;
}

const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r2 = (x: number) => Math.round(x * 100) / 100;

export interface ResultadoEquipo {
  teamId: string;
  roomId: string;
  puntaje: number; // promedio de los jueces de la sala (cada uno ya con el tope de C2)
  jueces: number;
  promedioC1: number;
  promedioC2: number;
  promedioC4: number;
  promedioC5: number;
  tiempoPromedioSeg: number;
}

/**
 * Puntaje del equipo en la sala: promedio de los jueces que lo evaluaron. Un juez con conflicto
 * no puntúa a ese equipo y su promedio se calcula con los restantes (rúbrica §8).
 */
export function puntajeEquipo(teamId: string, roomId: string, puntajes: PuntajeJuez[], conflictos: Set<string> = new Set()): ResultadoEquipo {
  const validos = puntajes.filter((p) => p.teamId === teamId && !conflictos.has(`${p.judgeId}_${teamId}`));
  return {
    teamId,
    roomId,
    puntaje: r2(promedio(validos.map(scoreTotal))),
    jueces: validos.length,
    promedioC1: r2(promedio(validos.map((p) => p.c1))),
    promedioC2: r2(promedio(validos.map((p) => p.c2))),
    promedioC4: r2(promedio(validos.map((p) => p.c4))),
    promedioC5: r2(promedio(validos.map((p) => p.c5))),
    tiempoPromedioSeg: Math.round(promedio(validos.map((p) => p.tiempoUsadoSeg))),
  };
}

export interface Normalizado extends ResultadoEquipo {
  z: number | null; // null si la sala no se normaliza
  sinNormalizar: boolean;
}

export interface Sala {
  roomId: string;
  equipos: number;
  promedio: number;
  desviacion: number;
  sinNormalizar: boolean;
}

/** Mínimo de equipos para normalizar una sala (rúbrica §5). */
export const MIN_EQUIPOS_NORMALIZAR = 4;

/**
 * Normalización z por sala (rúbrica §5): z = (puntaje − promedio de la sala) ÷ desviación de la
 * sala. Se usa la desviación estándar poblacional: la sala es toda la población evaluada (D-30).
 * Una sala con menos de 4 equipos no se normaliza (z = null) y el comité decide sus cupos.
 * Si todos los equipos de una sala tienen el mismo puntaje (desviación 0), z = 0 para todos.
 */
export function roomNormalization(resultados: ResultadoEquipo[]): { equipos: Normalizado[]; salas: Sala[] } {
  const porSala = new Map<string, ResultadoEquipo[]>();
  for (const r of resultados) porSala.set(r.roomId, [...(porSala.get(r.roomId) ?? []), r]);
  const salas: Sala[] = [];
  const equipos: Normalizado[] = [];
  for (const [roomId, lista] of porSala) {
    const media = promedio(lista.map((r) => r.puntaje));
    const desviacion = Math.sqrt(promedio(lista.map((r) => (r.puntaje - media) ** 2)));
    const sinNormalizar = lista.length < MIN_EQUIPOS_NORMALIZAR;
    salas.push({ roomId, equipos: lista.length, promedio: r2(media), desviacion: r2(desviacion), sinNormalizar });
    for (const r of lista) {
      const z = sinNormalizar ? null : desviacion === 0 ? 0 : Math.round(((r.puntaje - media) / desviacion) * 1000) / 1000;
      equipos.push({ ...r, z, sinNormalizar });
    }
  }
  return { equipos, salas };
}

/**
 * Desempate (rúbrica §6): mayor C2, luego mayor C1, luego menor tiempo de exposición. El cuarto
 * criterio (deliberación del jurado) es manual: si persiste el empate, devuelve 0.
 */
export function tiebreak(a: ResultadoEquipo, b: ResultadoEquipo): number {
  if (a.promedioC2 !== b.promedioC2) return b.promedioC2 - a.promedioC2;
  if (a.promedioC1 !== b.promedioC1) return b.promedioC1 - a.promedioC1;
  return a.tiempoPromedioSeg - b.tiempoPromedioSeg;
}

/** Orden por un valor principal (desc) y, en empate exacto, por el desempate oficial. */
function ordenar<T extends ResultadoEquipo>(lista: T[], valor: (r: T) => number): T[] {
  return [...lista].sort((a, b) => valor(b) - valor(a) || tiebreak(a, b));
}

export interface Ranking<T extends ResultadoEquipo = ResultadoEquipo> {
  orden: T[];
  /** Pares que siguen empatados tras C2, C1 y tiempo: los decide la deliberación del jurado. */
  empatesSinResolver: [string, string][];
}

function rankingPor<T extends ResultadoEquipo>(lista: T[], valor: (r: T) => number): Ranking<T> {
  const orden = ordenar(lista, valor);
  const empatesSinResolver: [string, string][] = [];
  for (let i = 1; i < orden.length; i++) {
    const a = orden[i - 1]!;
    const b = orden[i]!;
    if (valor(a) === valor(b) && tiebreak(a, b) === 0) empatesSinResolver.push([a.teamId, b.teamId]);
  }
  return { orden, empatesSinResolver };
}

export interface RankingGeneral extends Ranking<Normalizado> {
  /** Hay salas sin normalizar (menos de 4 equipos): el comité ubica a sus equipos (rúbrica §5). */
  requiereDecisionComite: boolean;
  salasSinNormalizar: string[];
}

/**
 * Ranking de una lista de equipos por z (rúbrica §5). Si ningún equipo tiene z (todas las salas
 * sin normalizar), ordena por puntaje y avisa al comité. Los equipos sin z van al final.
 */
export function rankingGeneral(normalizados: Normalizado[]): RankingGeneral {
  const salasSinNormalizar = [...new Set(normalizados.filter((n) => n.sinNormalizar).map((n) => n.roomId))];
  const conZ = normalizados.filter((n) => n.z !== null);
  const base = conZ.length ? rankingPor(conZ, (n) => n.z!) : rankingPor(normalizados, (n) => n.puntaje);
  const resto = conZ.length ? ordenar(normalizados.filter((n) => n.z === null), (n) => n.puntaje) : [];
  return {
    orden: [...base.orden, ...resto],
    empatesSinResolver: base.empatesSinResolver,
    requiereDecisionComite: salasSinNormalizar.length > 0,
    salasSinNormalizar,
  };
}

// ---------------------------------------------------------------------------
// Premios (guía §8, rúbrica §7)
// ---------------------------------------------------------------------------

export interface PropuestaPremios {
  primeroOpen: string | null;
  segundoOpen: string | null;
  mejorJunior: string | null;
  rankingOpen: RankingGeneral;
  rankingJunior: RankingGeneral;
}

/**
 * Propuesta de premios a partir del Show and Tell: 1.º y 2.º lugar Open y mejor equipo Junior
 * (reunión de staff del 10 nov 2026). Cada categoría se ordena por separado con el mismo z de su
 * sala. El comité confirma o corrige la propuesta antes de publicar.
 */
export function proponerPremios(normalizados: Normalizado[], esJunior: Record<string, boolean>): PropuestaPremios {
  const rankingOpen = rankingGeneral(normalizados.filter((n) => !esJunior[n.teamId]));
  const rankingJunior = rankingGeneral(normalizados.filter((n) => esJunior[n.teamId]));
  return {
    primeroOpen: rankingOpen.orden[0]?.teamId ?? null,
    segundoOpen: rankingOpen.orden[1]?.teamId ?? null,
    mejorJunior: rankingJunior.orden[0]?.teamId ?? null,
    rankingOpen,
    rankingJunior,
  };
}

export interface Premio {
  premio: string;
  teamId: string | null;
}

export interface DecisionPremios {
  primeroOpen: string | null;
  segundoOpen: string | null;
  mejorJunior: string | null;
}

/** Valida la decisión del comité: Open para los lugares Open, Junior para el premio Junior, sin repetir. */
export function validarPremios(d: DecisionPremios, esJunior: Record<string, boolean>, presentaron: Set<string>): string | null {
  const elegidos = [d.primeroOpen, d.segundoOpen, d.mejorJunior].filter((x): x is string => !!x);
  if (elegidos.some((t) => !presentaron.has(t))) return "Solo pueden recibir premios los equipos evaluados en el Show and Tell.";
  if (new Set(elegidos).size !== elegidos.length) return "Un equipo no puede recibir dos premios.";
  if ([d.primeroOpen, d.segundoOpen].some((t) => t && esJunior[t])) return "Los lugares Open son solo para equipos de la categoría Open.";
  if (d.mejorJunior && !esJunior[d.mejorJunior]) return "El premio Junior es solo para equipos de la categoría Junior.";
  if (!d.primeroOpen && d.segundoOpen) return "Asigna primero el 1.er lugar Open.";
  return null;
}

export function listaPremios(d: DecisionPremios): Premio[] {
  return [
    { premio: PREMIO.primeroOpen, teamId: d.primeroOpen },
    { premio: PREMIO.segundoOpen, teamId: d.segundoOpen },
    { premio: PREMIO.mejorJunior, teamId: d.mejorJunior },
  ];
}
