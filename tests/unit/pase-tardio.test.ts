import { describe, expect, it } from "vitest";
import { paseTardioDe, pasesTardios } from "@/lib/registro/pase-tardio";

describe("pase tardío", () => {
  const env = "Persona@Ejemplo.test:capa-8, otra@ejemplo.test:kolibits,malformado,:sin-correo";

  it("lee pares correo:equipo e ignora entradas inválidas", () => {
    expect(pasesTardios(env)).toEqual([
      { email: "persona@ejemplo.test", teamId: "capa-8" },
      { email: "otra@ejemplo.test", teamId: "kolibits" },
    ]);
  });

  it("habilita solo al correo configurado, sin importar mayúsculas", () => {
    expect(paseTardioDe(" PERSONA@ejemplo.test ", env)).toEqual({ email: "persona@ejemplo.test", teamId: "capa-8" });
    expect(paseTardioDe("intruso@ejemplo.test", env)).toBeNull();
    expect(paseTardioDe(null, env)).toBeNull();
    expect(pasesTardios(undefined)).toEqual([]);
  });
});
