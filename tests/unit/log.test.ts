import { describe, expect, it } from "vitest";
import { redactar } from "@/lib/log";

describe("redactar (ningún log con correos, teléfonos ni tokens)", () => {
  it("oculta correos, teléfonos y tokens dentro de texto", () => {
    const s = redactar(
      "ana@example.com llamó al +593 99 123 4567 con ghp_abcdefghijklmnopqrstuvwxyz0123 y sk-ant-abcdefghijklmnop1234",
    ) as string;
    expect(s).not.toMatch(/ana@example\.com|99 123|ghp_|sk-ant/);
    expect(s).toContain("[correo]");
    expect(s).toContain("[telefono]");
  });

  it("oculta JWT y claves AWS", () => {
    expect(redactar("eyJhbGciOi.eyJzdWIiOiIx.c2lnbmF0dXJl")).toBe("[jwt]");
    expect(redactar("AKIAABCDEFGHIJKLMNOP")).toBe("[clave-aws]");
  });

  it("oculta campos sensibles por nombre, en profundidad", () => {
    expect(redactar({ uid: "u1", datos: { email: "x", celular: "1", nivel: "colegio" } })).toEqual({
      uid: "u1",
      datos: { email: "[redactado]", celular: "[redactado]", nivel: "colegio" },
    });
  });
});
