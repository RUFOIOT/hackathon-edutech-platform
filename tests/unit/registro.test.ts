import { describe, expect, it } from "vitest";
import {
  cedulaValida,
  erroresPorCampo,
  paso1Schema,
  paso2Schema,
  paso4Schema,
  paso5Schema,
  representanteSchema,
  validarPdf,
} from "@/lib/validation/registro";
import { estadoEquipo, generarCodigo, hayLugar, invitacionesPermitidas, slugEquipo, vaAListaEspera } from "@/lib/registro/reglas";

const personales = {
  nombres: "Ana",
  apellidos: "Mora",
  celular: "099 123 4567",
  fechaNacimiento: "2000-05-10",
  ciudad: "Quito",
  institucion: "Universidad Demo",
  nivel: "universidad",
  githubUsername: "ana-mora",
  talla: "M",
};

describe("paso 1 · modalidad", () => {
  it("unirse exige un código de 6 caracteres sin letras ambiguas", () => {
    expect(paso1Schema.safeParse({ modo: "unirse", codigo: "k7pm3q" }).success).toBe(true);
    expect(paso1Schema.safeParse({ modo: "unirse", codigo: "K7PM30" }).success).toBe(false);
    expect(paso1Schema.safeParse({ modo: "unirse" }).success).toBe(false);
    expect(paso1Schema.safeParse({ modo: "individual" }).success).toBe(true);
  });
});

describe("paso 2 · datos personales", () => {
  it("acepta datos válidos y normaliza el celular", () => {
    expect(paso2Schema.parse(personales).celular).toBe("0991234567");
  });

  it("bloquea a menores de 14 al día del evento con un mensaje claro", () => {
    const r = paso2Schema.safeParse({ ...personales, fechaNacimiento: "2013-01-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect(erroresPorCampo(r.error).fechaNacimiento).toMatch(/al menos 14 años/);
  });

  it("valida usuario de GitHub y celular", () => {
    expect(paso2Schema.safeParse({ ...personales, githubUsername: "@ana" }).success).toBe(false);
    expect(paso2Schema.safeParse({ ...personales, githubUsername: "ana--mora" }).success).toBe(false);
    expect(paso2Schema.safeParse({ ...personales, celular: "12345" }).success).toBe(false);
    expect(paso2Schema.safeParse({ ...personales, celular: "+14155550100" }).success).toBe(true);
  });
});

describe("paso 4 · equipo", () => {
  const equipo = { nombreEquipo: "Matrícula Express", track: "T3", problemaCandidato: "Las matrículas toman tres días de filas en secretaría." };

  it("exige entre 1 y 4 correos adicionales, sin repetir", () => {
    expect(paso4Schema.safeParse({ ...equipo, correosIntegrantes: [] }).success).toBe(false);
    expect(paso4Schema.safeParse({ ...equipo, correosIntegrantes: ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"] }).success).toBe(false);
    expect(paso4Schema.safeParse({ ...equipo, correosIntegrantes: ["a@x.com", "A@x.com"] }).success).toBe(false);
    expect(paso4Schema.safeParse({ ...equipo, correosIntegrantes: ["a@x.com"] }).success).toBe(true);
  });

  it("limita el problema candidato a 280 caracteres", () => {
    expect(paso4Schema.safeParse({ ...equipo, problemaCandidato: "x".repeat(281), correosIntegrantes: ["a@x.com"] }).success).toBe(false);
  });
});

describe("paso 5 · consentimientos y representante", () => {
  it("reglas y datos son obligatorios; imagen es opcional", () => {
    expect(paso5Schema.safeParse({ aceptaReglas: true, aceptaDatos: true }).success).toBe(true);
    expect(paso5Schema.safeParse({ aceptaReglas: true, aceptaDatos: false }).success).toBe(false);
  });

  it("valida la cédula ecuatoriana con dígito verificador", () => {
    expect(cedulaValida("1710034065")).toBe(true);
    expect(cedulaValida("1710034066")).toBe(false);
    expect(cedulaValida("9910034065")).toBe(false);
    expect(
      representanteSchema.safeParse({ nombres: "María Pérez", cedula: "1710034065", correo: "m@x.com", celular: "0991112233", parentesco: "Madre" })
        .success,
    ).toBe(true);
  });

  it("acepta solo PDF reales de hasta 4 MB", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 contenido");
    expect(validarPdf("aut.pdf", "application/pdf", pdf)).toBeNull();
    expect(validarPdf("aut.pdf", "application/pdf", new TextEncoder().encode("hola"))).toMatch(/PDF/);
    expect(validarPdf("aut.png", "image/png", pdf)).toMatch(/PDF/);
    expect(validarPdf("aut.pdf", "application/pdf", new Uint8Array(4 * 1024 * 1024 + 1))).toMatch(/4 MB/);
  });
});

describe("reglas de negocio", () => {
  it("lista de espera al llenarse el cupo de personas o de equipos", () => {
    const cupo = { maxPersonas: 150, maxEquipos: 30 };
    expect(vaAListaEspera({ personas: 149, equipos: 10 }, false, cupo)).toBe(false);
    expect(vaAListaEspera({ personas: 150, equipos: 10 }, false, cupo)).toBe(true);
    expect(vaAListaEspera({ personas: 100, equipos: 30 }, true, cupo)).toBe(true);
    expect(vaAListaEspera({ personas: 100, equipos: 30 }, false, cupo)).toBe(false);
  });

  it("equipos de 2 a 5", () => {
    expect(estadoEquipo(1)).toBe("incompleto");
    expect(estadoEquipo(2)).toBe("completo");
    expect(hayLugar(4)).toBe(true);
    expect(hayLugar(5)).toBe(false);
    expect(invitacionesPermitidas(1, 3)).toBe(1);
    expect(invitacionesPermitidas(3, 3)).toBe(0);
  });

  it("códigos de invitación sin caracteres ambiguos y slugs limpios", () => {
    for (let i = 0; i < 50; i++) expect(generarCodigo()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(slugEquipo("  Matrícula Express!! ")).toBe("matricula-express");
  });
});
