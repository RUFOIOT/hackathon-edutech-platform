import { afterEach, describe, expect, it } from "vitest";
import { camposAnonimos, fechaRetencion, mesesRetencion } from "@/lib/privacidad/retencion";
import { LIMITES, hashClave, ipDe, mensajeLimite, ventana } from "@/lib/seguridad/limite";

describe("límite de peticiones", () => {
  it("la ventana fija cambia exactamente al cumplirse su duración", () => {
    const t = Date.UTC(2026, 10, 6, 15, 0, 0);
    expect(ventana(t, 600)).toEqual({ indice: Math.floor(t / 1000 / 600), restanSeg: 600 });
    expect(ventana(t + 599_000, 600).indice).toBe(ventana(t, 600).indice);
    expect(ventana(t + 599_000, 600).restanSeg).toBe(1);
    expect(ventana(t + 600_000, 600).indice).toBe(ventana(t, 600).indice + 1);
  });

  it("toma la IP del edge de Netlify antes que X-Forwarded-For", () => {
    expect(ipDe(new Headers({ "x-nf-client-connection-ip": "1.1.1.1", "x-forwarded-for": "9.9.9.9" }))).toBe("1.1.1.1");
    expect(ipDe(new Headers({ "x-forwarded-for": "2.2.2.2, 10.0.0.1" }))).toBe("2.2.2.2");
    expect(ipDe(new Headers())).toBe("desconocida");
  });

  it("no guarda la IP en claro y el hash es estable", () => {
    const h = hashClave("181.39.10.20");
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain("181");
    expect(hashClave("181.39.10.20")).toBe(h);
    expect(hashClave("181.39.10.21")).not.toBe(h);
  });

  it("los límites por IP del registro admiten un salón entero detrás de la misma IP", () => {
    expect(LIMITES.registroIp.max).toBeGreaterThanOrEqual(150);
    expect(LIMITES.sesion.max).toBeGreaterThanOrEqual(100);
  });

  it("el mensaje dice cuánto esperar", () => {
    expect(mensajeLimite({ reintentarEnSeg: 30 })).toContain("1 minuto");
    expect(mensajeLimite({ reintentarEnSeg: 301 })).toContain("6 minutos");
  });
});

describe("retención", () => {
  afterEach(() => {
    delete process.env.RETENCION_MESES;
  });

  it("anonimiza 12 meses después de la premiación por defecto", () => {
    expect(mesesRetencion()).toBe(12);
    expect(fechaRetencion().toISOString()).toBe("2027-11-07T23:30:00.000Z");
  });

  it("el plazo es configurable con RETENCION_MESES", () => {
    process.env.RETENCION_MESES = "6";
    expect(fechaRetencion().toISOString()).toBe("2027-05-07T23:30:00.000Z");
    process.env.RETENCION_MESES = "no-es-numero";
    expect(mesesRetencion()).toBe(12);
  });

  it("anonimizar borra todo dato de contacto o identidad y conserva lo estadístico", () => {
    const c = camposAnonimos("solicitud");
    for (const campo of ["email", "celular", "fechaNacimiento", "institucion", "githubUsername", "accesibilidad", "restriccionesAlimentarias"]) {
      expect(c[campo], campo).toBeNull();
    }
    expect(c.nombres).toBe("Participante anonimizado");
    expect(c.apellidos).toBe("");
    expect(c.anonimizado).toBe(true);
    for (const conservado of ["categoria", "nivel", "ciudad", "perfilTecnico", "teamId"]) expect(c).not.toHaveProperty(conservado);
  });
});
