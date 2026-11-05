import { describe, expect, it } from "vitest";
import { errorAlEnviarEnlace } from "@/lib/auth/constantes";

describe("errorAlEnviarEnlace", () => {
  it("explica la cuota diaria agotada sin culpar a la conexión", () => {
    expect(errorAlEnviarEnlace({ code: "auth/quota-exceeded" })).toMatch(/límite de enlaces/);
  });

  it("distingue la falta de conexión", () => {
    expect(errorAlEnviarEnlace({ code: "auth/network-request-failed" })).toMatch(/Sin conexión/);
  });

  it("da un mensaje genérico ante errores desconocidos", () => {
    expect(errorAlEnviarEnlace(new Error("x"))).toMatch(/No pudimos enviar el enlace/);
    expect(errorAlEnviarEnlace(null)).toMatch(/No pudimos enviar el enlace/);
  });
});
