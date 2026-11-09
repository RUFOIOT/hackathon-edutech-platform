import { describe, expect, it } from "vitest";
import { dentroDeVentana, faseActual, inscripcionesAbiertas } from "@/lib/event/phase";

// Las horas se expresan en hora de Ecuador (-05:00), igual que en la guía.
const ec = (s: string) => new Date(`${s}-05:00`);

describe("faseActual", () => {
  it.each([
    ["2026-10-15T10:00:00", "Convocatoria"],
    ["2026-11-27T11:59:59", "Convocatoria"],
    ["2026-11-27T12:00:00", "Pre-evento"],
    ["2026-11-27T16:59:59", "Pre-evento"],
    ["2026-11-27T17:00:00", "Hacking"],
    ["2026-11-28T11:59:59", "Hacking"],
    ["2026-11-28T12:00:00", "Code freeze"],
    ["2026-11-28T13:30:00", "Show and Tell"],
    ["2026-11-28T18:30:00", "Resultados"],
  ])("%s → %s", (hora, fase) => {
    expect(faseActual(ec(hora))).toBe(fase);
  });

  it("no depende de la zona horaria del servidor: 22:00 UTC del viernes es el kick-off", () => {
    expect(faseActual(new Date("2026-11-27T22:00:00Z"))).toBe("Hacking");
    expect(faseActual(new Date("2026-11-27T21:59:59Z"))).toBe("Pre-evento");
  });
});

describe("ventanas", () => {
  it("inscripciones abiertas solo entre apertura y cierre", () => {
    expect(inscripcionesAbiertas(ec("2026-10-04T23:59:59"))).toBe(false);
    expect(inscripcionesAbiertas(ec("2026-10-05T00:00:00"))).toBe(true);
    expect(inscripcionesAbiertas(ec("2026-11-27T11:59:59"))).toBe(true);
    expect(inscripcionesAbiertas(ec("2026-11-27T12:00:00"))).toBe(false);
  });

  it("ventana de hacking: viernes 17:00 a sábado 12:00", () => {
    expect(dentroDeVentana(ec("2026-11-27T16:59:59"))).toBe(false);
    expect(dentroDeVentana(ec("2026-11-27T17:00:00"))).toBe(true);
    expect(dentroDeVentana(ec("2026-11-28T12:00:00"))).toBe(false);
  });
});

describe("apertura de prueba (INSCRIPCIONES_PRUEBA)", () => {
  const antesDeAbrir = new Date("2026-10-02T10:00:00-05:00");
  const despuesDelCierre = new Date("2026-11-27T13:00:00-05:00");

  it("sin la variable, respeta la fecha de apertura", () => {
    delete process.env.INSCRIPCIONES_PRUEBA;
    expect(inscripcionesAbiertas(antesDeAbrir)).toBe(false);
  });

  it("con la variable abre antes de tiempo, pero nunca después del cierre", () => {
    process.env.INSCRIPCIONES_PRUEBA = "abiertas";
    try {
      expect(inscripcionesAbiertas(antesDeAbrir)).toBe(true);
      expect(inscripcionesAbiertas(despuesDelCierre)).toBe(false);
    } finally {
      delete process.env.INSCRIPCIONES_PRUEBA;
    }
  });
});
