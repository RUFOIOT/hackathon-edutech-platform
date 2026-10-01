import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cabecerasFirmadas, firmar, verificarFirma } from "@/lib/hmac";
import { tokenQr, verificarTokenQr } from "@/lib/checkin/qr";

const SECRETO = "secreto-de-prueba-con-32-caracteres!!";

describe("HMAC app ↔ n8n", () => {
  const cuerpo = JSON.stringify({ type: "registration.created", payload: { id: "p-1" } });
  const ahora = new Date("2026-10-15T15:00:00Z");

  it("firma = HMAC-SHA256(secreto, timestamp.cuerpo) en hex con prefijo sha256=", () => {
    const esperado = createHmac("sha256", SECRETO).update(`1792076400.${cuerpo}`).digest("hex");
    expect(firmar(SECRETO, 1792076400, cuerpo)).toBe(`sha256=${esperado}`);
  });

  it("ida y vuelta: lo que firma la app lo verifica el receptor", () => {
    const h = cabecerasFirmadas(SECRETO, cuerpo, ahora);
    expect(verificarFirma({ secreto: SECRETO, cuerpo, timestamp: h["X-Timestamp"]!, firma: h["X-Signature"]!, ahora })).toEqual({ ok: true });
  });

  it("rechaza cuerpo alterado, otro secreto o timestamp cambiado", () => {
    const h = cabecerasFirmadas(SECRETO, cuerpo, ahora);
    const base = { secreto: SECRETO, cuerpo, timestamp: h["X-Timestamp"]!, firma: h["X-Signature"]!, ahora };
    expect(verificarFirma({ ...base, cuerpo: cuerpo.replace("p-1", "p-2") })).toMatchObject({ ok: false, motivo: "firma-invalida" });
    expect(verificarFirma({ ...base, secreto: "otro" })).toMatchObject({ ok: false, motivo: "firma-invalida" });
    expect(verificarFirma({ ...base, timestamp: String(Number(base.timestamp) + 1) })).toMatchObject({ ok: false, motivo: "firma-invalida" });
  });

  it("rechaza fuera de la ventana de 5 minutos y cabeceras faltantes", () => {
    const h = cabecerasFirmadas(SECRETO, cuerpo, ahora);
    const tarde = new Date(ahora.getTime() + 301_000);
    expect(
      verificarFirma({ secreto: SECRETO, cuerpo, timestamp: h["X-Timestamp"]!, firma: h["X-Signature"]!, ahora: tarde }),
    ).toMatchObject({ motivo: "fuera-de-ventana" });
    expect(verificarFirma({ secreto: SECRETO, cuerpo, timestamp: null, firma: null })).toMatchObject({ motivo: "faltan-cabeceras" });
  });
});

describe("QR de check-in", () => {
  it("el token verifica y devuelve el uid", () => {
    expect(verificarTokenQr(SECRETO, tokenQr(SECRETO, "p-001"))).toBe("p-001");
  });

  it("no se puede fabricar el QR de otra persona", () => {
    const t = tokenQr(SECRETO, "p-001");
    expect(verificarTokenQr(SECRETO, t.replace("p-001", "p-002"))).toBeNull();
    expect(verificarTokenQr("otro-secreto", t)).toBeNull();
    expect(verificarTokenQr(SECRETO, "basura")).toBeNull();
  });
});
