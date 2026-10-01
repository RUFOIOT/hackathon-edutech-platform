import { describe, expect, it } from "vitest";
import { destinoSeguro, inicioPara, puedeEntrarAdmin, type Identidad } from "@/lib/auth/roles";

const id = (over: Partial<Identidad>): Identidad => ({ uid: "u", staffRoles: [], esJuez: false, esParticipante: false, ...over });

describe("puedeEntrarAdmin", () => {
  it("checkin solo entra al check-in", () => {
    const checkin = id({ staffRoles: ["checkin"] });
    expect(puedeEntrarAdmin(checkin, "/admin/checkin")).toBe(true);
    expect(puedeEntrarAdmin(checkin, "/admin")).toBe(false);
    expect(puedeEntrarAdmin(checkin, "/admin/resultados")).toBe(false);
  });

  it("mesa técnica no entra a resultados, jurado ni auditoría", () => {
    const mt = id({ staffRoles: ["mesa_tecnica"] });
    expect(puedeEntrarAdmin(mt, "/admin/repositorios")).toBe(true);
    expect(puedeEntrarAdmin(mt, "/admin/resultados")).toBe(false);
    expect(puedeEntrarAdmin(mt, "/admin/jurado")).toBe(false);
    expect(puedeEntrarAdmin(mt, "/admin/auditoria")).toBe(false);
  });

  it("usa el prefijo más largo (subrutas heredan la regla de su sección)", () => {
    expect(puedeEntrarAdmin(id({ staffRoles: ["checkin"] }), "/admin/checkin/manual")).toBe(true);
  });

  it("participantes y jueces no entran a /admin", () => {
    expect(puedeEntrarAdmin(id({ esParticipante: true, esJuez: true }), "/admin")).toBe(false);
  });

  it("rutas desconocidas se niegan", () => {
    expect(puedeEntrarAdmin(id({ staffRoles: ["admin"] }), "/administrador")).toBe(false);
  });
});

describe("inicioPara", () => {
  it("dirige según el rol", () => {
    expect(inicioPara(id({ staffRoles: ["comite"] }))).toBe("/admin");
    expect(inicioPara(id({ staffRoles: ["checkin"] }))).toBe("/admin/checkin");
    expect(inicioPara(id({ esJuez: true }))).toBe("/jurado");
    expect(inicioPara(id({ esParticipante: true }))).toBe("/mi-equipo");
    expect(inicioPara(id({}))).toBe("/registro");
  });
});

describe("destinoSeguro (sin redirecciones abiertas)", () => {
  it.each([
    ["/mi-equipo", "/mi-equipo"],
    ["/jurado/abc-123", "/jurado/abc-123"],
    ["//evil.com", null],
    ["https://evil.com", null],
    ["/\\evil.com", null],
    ["/a?x=//evil", null],
    [42, null],
  ])("%s → %s", (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado);
  });
});
