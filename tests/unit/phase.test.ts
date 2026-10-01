import { describe, expect, it } from "vitest";
import { dentroDeVentana, faseActual, inscripcionesAbiertas } from "@/lib/event/phase";

// Las horas se expresan en hora de Ecuador (-05:00), igual que en la guía.
const ec = (s: string) => new Date(`${s}-05:00`);

describe("faseActual", () => {
  it.each([
    ["2026-10-15T10:00:00", "Convocatoria"],
    ["2026-10-30T23:58:59", "Convocatoria"],
    ["2026-10-30T23:59:00", "Pre-evento"],
    ["2026-11-06T15:29:59", "Pre-evento"],
    ["2026-11-06T15:30:00", "Hacking"],
    ["2026-11-07T11:59:59", "Hacking"],
    ["2026-11-07T12:00:00", "Code freeze"],
    ["2026-11-07T13:30:00", "Show and Tell"],
    ["2026-11-07T18:30:00", "Resultados"],
  ])("%s → %s", (hora, fase) => {
    expect(faseActual(ec(hora))).toBe(fase);
  });

  it("no depende de la zona horaria del servidor: 20:30 UTC del viernes es el kick-off", () => {
    expect(faseActual(new Date("2026-11-06T20:30:00Z"))).toBe("Hacking");
    expect(faseActual(new Date("2026-11-06T20:29:59Z"))).toBe("Pre-evento");
  });
});

describe("ventanas", () => {
  it("inscripciones abiertas solo entre apertura y cierre", () => {
    expect(inscripcionesAbiertas(ec("2026-10-04T23:59:59"))).toBe(false);
    expect(inscripcionesAbiertas(ec("2026-10-05T00:00:00"))).toBe(true);
    expect(inscripcionesAbiertas(ec("2026-10-30T23:59:00"))).toBe(false);
  });

  it("ventana de hacking: viernes 15:30 a sábado 12:00", () => {
    expect(dentroDeVentana(ec("2026-11-06T15:30:00"))).toBe(true);
    expect(dentroDeVentana(ec("2026-11-07T12:00:00"))).toBe(false);
  });
});
