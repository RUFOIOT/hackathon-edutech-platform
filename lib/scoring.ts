import { RUBRICA, TOPE_C2_UNO, type CriterioCodigo } from "@/lib/models/rubrica";

/**
 * Cálculo de puntajes (rúbrica §4–§7). Funciones puras: las usan /admin/resultados, la
 * publicación y los tests. Equivalen a las funciones SQL score_total, room_normalization y
 * tiebreak del prompt (D-01).
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
 * criterio (votación del jurado de la final) es manual: si persiste el empate, devuelve 0.
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
  /** Pares que siguen empatados tras C2, C1 y tiempo: los decide la votación del jurado de la final. */
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

export interface PropuestaFinalistas {
  finalistas: string[];
  /** Hay salas sin normalizar: el comité decide sus cupos (rúbrica §5). */
  requiereDecisionComite: boolean;
  salasSinNormalizar: string[];
  empatesSinResolver: [string, string][];
}

/** Los 5 mejores z pasan a la final. Las salas sin normalizar quedan para decisión del comité. */
export function seleccionarFinalistas(normalizados: Normalizado[], cupos = 5): PropuestaFinalistas {
  const conZ = normalizados.filter((n) => n.z !== null);
  const { orden, empatesSinResolver } = rankingPor(conZ, (n) => n.z!);
  const salasSinNormalizar = [...new Set(normalizados.filter((n) => n.sinNormalizar).map((n) => n.roomId))];
  const corte = orden.slice(0, cupos).map((n) => n.teamId);
  return {
    finalistas: corte,
    requiereDecisionComite: salasSinNormalizar.length > 0,
    salasSinNormalizar,
    // Solo importan los empates que tocan el corte de la final.
    empatesSinResolver: empatesSinResolver.filter(([a, b]) => corte.includes(a) || corte.includes(b)),
  };
}

/** Ranking de la final: puntajes desde cero (no se arrastran los de la semifinal). */
export function rankingFinal(resultadosFinal: ResultadoEquipo[]): Ranking {
  return rankingPor(resultadosFinal, (r) => r.puntaje);
}

// ---------------------------------------------------------------------------
// Premios (guía §8, rúbrica §7)
// ---------------------------------------------------------------------------

export interface DatosPremios {
  /** Orden final ya resuelto (incluye la decisión manual de empates si la hubo). */
  ordenFinal: string[];
  semifinal: ResultadoEquipo[];
  track: Record<string, "T1" | "T2" | "T3">;
  tieneN8n: Record<string, boolean>;
  esJunior: Record<string, boolean>; // equipo 100 % Junior
}

export interface Premio {
  premio: string;
  teamId: string | null;
  nota?: string;
}

/**
 * Asigna premios generales (1.º–3.º de la final) y especiales. Un equipo puede recibir como máximo
 * un premio general y uno especial (guía §8): si ya tiene un especial, el siguiente pasa al
 * siguiente elegible. Orden de asignación de especiales: por track, n8n, Junior (D-31).
 * La Aceleradora la decide el comité: solo se propone una lista.
 */
export function calcularPremios(d: DatosPremios): { premios: Premio[]; candidatosAceleradora: string[] } {
  const premios: Premio[] = [];
  const generales = d.ordenFinal.slice(0, 3);
  ["1er lugar general", "2do lugar general", "3er lugar general"].forEach((p, i) => premios.push({ premio: p, teamId: generales[i] ?? null }));

  const conEspecial = new Set<string>();
  const primero = (lista: ResultadoEquipo[], valor: (r: ResultadoEquipo) => number, excluir: Set<string> = new Set()) => {
    const elegible = ordenar(lista, valor).find((r) => !excluir.has(r.teamId) && !conEspecial.has(r.teamId));
    if (elegible) conEspecial.add(elegible.teamId);
    return elegible?.teamId ?? null;
  };

  for (const t of ["T1", "T2", "T3"] as const) {
    // Mejor por track: mayor puntaje de la semifinal en el track, excluyendo a los 3 generales.
    const lista = d.semifinal.filter((r) => d.track[r.teamId] === t);
    premios.push({ premio: `Mejor solución ${t}`, teamId: primero(lista, (r) => r.puntaje, new Set(generales)) });
  }
  const conN8n = d.semifinal.filter((r) => d.tieneN8n[r.teamId]);
  const n8n = primero(conN8n, (r) => r.promedioC4);
  const c4Ganador = conN8n.find((x) => x.teamId === n8n)?.promedioC4;
  const empateN8n = n8n !== null && conN8n.some((r) => r.teamId !== n8n && !conEspecial.has(r.teamId) && r.promedioC4 === c4Ganador);
  premios.push({
    premio: "Premio n8n a la mejor automatización",
    teamId: n8n,
    nota: empateN8n ? "Empate en C4: desempata el representante de n8n." : undefined,
  });
  premios.push({ premio: "Mejor equipo Junior", teamId: primero(d.semifinal.filter((r) => d.esJunior[r.teamId]), (r) => r.puntaje) });

  // Aceleradora: el comité elige entre el top 10, priorizando C1 y C5.
  const top10 = ordenar(d.semifinal, (r) => r.puntaje).slice(0, 10);
  const candidatosAceleradora = [...top10].sort((a, b) => b.promedioC1 + b.promedioC5 - (a.promedioC1 + a.promedioC5)).map((r) => r.teamId);
  return { premios, candidatosAceleradora };
}
