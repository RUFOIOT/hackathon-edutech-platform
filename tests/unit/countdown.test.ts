import { describe, expect, it } from "vitest";
import { fecha } from "@/config/event";
import { fechaEnEcuador, restante, restanteEnPalabras } from "@/lib/event/countdown";

describe("cuenta regresiva al kick-off (America/Guayaquil)", () => {
  const kickoff = fecha("kickoff");

  it("el kick-off es el viernes 6 a las 15:30 de Ecuador = 20:30 UTC", () => {
    expect(kickoff.toISOString()).toBe("2026-11-06T20:30:00.000Z");
    expect(fechaEnEcuador(kickoff)).toMatch(/^viernes,? 6 de noviembre, 15:30$/);
  });

  it("muestra la hora de Ecuador aunque el instante caiga en otro día en UTC", () => {
    // 21:00 del viernes en Quito = 02:00 UTC del sábado.
    expect(fechaEnEcuador(new Date("2026-11-07T02:00:00Z"))).toMatch(/6 de noviembre, 21:00$/);
  });

  it("calcula días, horas, minutos y segundos exactos", () => {
    // 1 oct 2026 09:00 en Ecuador → faltan 36 d 6 h 30 m 0 s.
    expect(restante(kickoff, new Date("2026-10-01T09:00:00-05:00"))).toEqual({
      dias: 36,
      horas: 6,
      minutos: 30,
      segundos: 0,
      terminado: false,
    });
    expect(restante(kickoff, new Date("2026-11-06T15:29:59-05:00"))).toMatchObject({ dias: 0, horas: 0, minutos: 0, segundos: 1 });
  });

  it("el mismo instante da el mismo resultado expresado en cualquier zona", () => {
    const enTokio = new Date("2026-11-06T05:30:00+09:00");
    const enQuito = new Date("2026-11-05T15:30:00-05:00");
    expect(restante(kickoff, enTokio)).toEqual(restante(kickoff, enQuito));
    expect(restante(kickoff, enQuito).dias).toBe(1);
  });

  it("al llegar la hora marca terminado y no da negativos", () => {
    expect(restante(kickoff, kickoff).terminado).toBe(true);
    expect(restante(kickoff, new Date("2026-11-07T00:00:00-05:00"))).toMatchObject({ dias: 0, segundos: 0, terminado: true });
  });

  it("texto accesible con singular y plural", () => {
    expect(restanteEnPalabras({ dias: 1, horas: 2, minutos: 1, segundos: 0, terminado: false })).toBe(
      "Faltan 1 día, 2 horas y 1 minuto para el kick-off.",
    );
  });
});
