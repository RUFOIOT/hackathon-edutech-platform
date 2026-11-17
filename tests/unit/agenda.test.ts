import { describe, expect, it } from "vitest";
import { AGENDA, EVENT } from "@/config/event";
import { bloquesAgenda, estadoAgenda } from "@/lib/event/agenda";

const bloques = bloquesAgenda();
const en = (iso: string) => estadoAgenda(bloques, new Date(iso));
const indice = (dia: string, hora: string) => AGENDA.findIndex((a) => a.dia === dia && a.hora === hora);

describe("bloquesAgenda", () => {
  it("da a cada bloque su instante con offset -05:00 y lo termina donde empieza el siguiente", () => {
    expect(bloques).toHaveLength(AGENDA.length);
    const kickoff = bloques[indice("Viernes 27", "17:00")]!;
    expect(new Date(kickoff.inicioIso).getTime()).toBe(new Date(EVENT.fechas.kickoff.iso).getTime());
    expect(kickoff.finIso).toBe(bloques[indice("Viernes 27", "17:00") + 1]!.inicioIso);
    expect(bloques.every((b) => b.inicioIso.endsWith("-05:00"))).toBe(true);
  });

  it("los bloques van en orden y el último termina con el cierre del evento", () => {
    for (let i = 1; i < bloques.length; i++) {
      expect(new Date(bloques[i]!.inicioIso).getTime()).toBeGreaterThan(new Date(bloques[i - 1]!.inicioIso).getTime());
    }
    expect(bloques.at(-1)!.finIso).toBe(EVENT.fechas.cierreEvento.iso);
  });
});

describe("estadoAgenda", () => {
  it("fuera del evento no resalta nada", () => {
    expect(en("2026-11-17T10:00:00-05:00")).toEqual({ actual: null, siguiente: null });
    expect(en("2026-11-26T23:59:59-05:00")).toEqual({ actual: null, siguiente: null });
    expect(en(EVENT.fechas.cierreEvento.iso)).toEqual({ actual: null, siguiente: null });
    expect(en("2026-11-29T09:00:00-05:00")).toEqual({ actual: null, siguiente: null });
  });

  it("la mañana del viernes anuncia el primer bloque como siguiente", () => {
    expect(en("2026-11-27T09:00:00-05:00")).toEqual({ actual: null, siguiente: 0 });
  });

  it("durante el kick-off marca ese bloque y el que sigue", () => {
    const i = indice("Viernes 27", "17:00");
    expect(en("2026-11-27T17:00:00-05:00")).toEqual({ actual: i, siguiente: i + 1 });
    expect(en("2026-11-27T17:44:59-05:00")).toEqual({ actual: i, siguiente: i + 1 });
    expect(en("2026-11-27T17:45:00-05:00")).toEqual({ actual: i + 1, siguiente: i + 2 });
  });

  it("de noche sigue vigente el cierre de sede y lo siguiente es la apertura del sábado", () => {
    expect(en("2026-11-28T02:00:00-05:00")).toEqual({ actual: indice("Viernes 27", "21:00"), siguiente: indice("Sábado 28", "08:00") });
  });

  it("en el último bloque ya no hay siguiente", () => {
    expect(en("2026-11-28T16:50:00-05:00")).toEqual({ actual: AGENDA.length - 1, siguiente: null });
  });

  it("no depende de la zona horaria: el mismo instante en UTC da el mismo resultado", () => {
    expect(en("2026-11-27T22:00:00Z")).toEqual(en("2026-11-27T17:00:00-05:00"));
  });
});
