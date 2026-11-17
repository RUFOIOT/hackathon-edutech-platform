import { AGENDA, EVENT } from "@/config/event";

/** Bloque de la agenda con su inicio y fin como instantes ISO (-05:00). */
export interface BloqueAgenda {
  dia: (typeof AGENDA)[number]["dia"];
  hora: string;
  bloque: string;
  hito: boolean;
  inicioIso: string;
  finIso: string;
}

/**
 * Agenda de config/event.ts con instantes. La fecha de cada día sale de las fechas clave del
 * evento (kick-off el viernes, cierre el sábado) y la hora lleva el offset -05:00 de Ecuador.
 * Un bloque termina cuando empieza el siguiente; el último, en el cierre del evento.
 */
export function bloquesAgenda(): BloqueAgenda[] {
  const fechaDe: Record<BloqueAgenda["dia"], string> = {
    "Viernes 27": EVENT.fechas.kickoff.iso.slice(0, 10),
    "Sábado 28": EVENT.fechas.cierreEvento.iso.slice(0, 10),
  };
  const inicios = AGENDA.map((a) => `${fechaDe[a.dia]}T${a.hora}:00-05:00`);
  return AGENDA.map((a, i) => ({
    dia: a.dia,
    hora: a.hora,
    bloque: a.bloque,
    hito: a.hito === true,
    inicioIso: inicios[i]!,
    finIso: inicios[i + 1] ?? EVENT.fechas.cierreEvento.iso,
  }));
}

/** Posición en `bloques` del bloque en curso y del siguiente; `null` si no aplica. */
export interface EstadoAgenda {
  actual: number | null;
  siguiente: number | null;
}

const SIN_ESTADO: EstadoAgenda = { actual: null, siguiente: null };

/**
 * Qué bloque ocurre ahora y cuál sigue. Solo responde durante el evento: desde las 00:00 (hora de
 * Ecuador) del primer día hasta el fin del último bloque. Fuera de ese rango no resalta nada.
 * Compara instantes, así que no depende de la zona horaria del navegador.
 */
export function estadoAgenda(bloques: readonly Pick<BloqueAgenda, "inicioIso" | "finIso">[], ahora: Date): EstadoAgenda {
  const primero = bloques[0];
  const ultimo = bloques[bloques.length - 1];
  if (!primero || !ultimo) return SIN_ESTADO;
  const t = ahora.getTime();
  const desde = new Date(`${primero.inicioIso.slice(0, 10)}T00:00:00-05:00`).getTime();
  if (t < desde || t >= new Date(ultimo.finIso).getTime()) return SIN_ESTADO;

  let actual: number | null = null;
  bloques.forEach((b, i) => {
    if (t >= new Date(b.inicioIso).getTime() && t < new Date(b.finIso).getTime()) actual = i;
  });
  const siguiente = bloques.findIndex((b) => new Date(b.inicioIso).getTime() > t);
  return { actual, siguiente: siguiente === -1 ? null : siguiente };
}
