import { describe, expect, it } from "vitest";
import { calcularCategoria, categoriaEquipo, edadEn } from "@/lib/models/categoria";

describe("edadEn", () => {
  const kickoff = new Date("2026-11-06T15:30:00-05:00");

  it("cuenta el cumpleaños del mismo día", () => {
    expect(edadEn("2008-11-06", kickoff)).toBe(18);
    expect(edadEn("2008-11-07", kickoff)).toBe(17);
  });

  it("usa la fecha civil de Ecuador, no la UTC", () => {
    // 23:30 del 5 nov en Ecuador = 04:30 UTC del 6 nov: aún no cumple.
    expect(edadEn("2008-11-06", new Date("2026-11-06T04:30:00Z"))).toBe(17);
  });

  it("rechaza formatos inválidos", () => {
    expect(() => edadEn("06/11/2008", kickoff)).toThrow(/AAAA-MM-DD/);
  });
});

describe("calcularCategoria (al día del kick-off)", () => {
  it("menor de 14 no puede inscribirse", () => {
    const r = calcularCategoria("2012-11-07");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/al menos 14 años/);
  });

  it("14 a 17 es JUNIOR", () => {
    expect(calcularCategoria("2012-11-06")).toMatchObject({ ok: true, categoria: "JUNIOR", edad: 14 });
    expect(calcularCategoria("2008-11-07")).toMatchObject({ ok: true, categoria: "JUNIOR", edad: 17 });
  });

  it("18 o más es OPEN", () => {
    expect(calcularCategoria("2008-11-06")).toMatchObject({ ok: true, categoria: "OPEN", edad: 18 });
    expect(calcularCategoria("1980-01-01")).toMatchObject({ ok: true, categoria: "OPEN" });
  });
});

describe("categoriaEquipo", () => {
  it("JUNIOR solo si todos son JUNIOR", () => {
    expect(categoriaEquipo(["JUNIOR", "JUNIOR"])).toBe("JUNIOR");
    expect(categoriaEquipo(["JUNIOR", "OPEN"])).toBe("MIXTO");
    expect(categoriaEquipo(["OPEN", "OPEN"])).toBe("OPEN");
  });
});
