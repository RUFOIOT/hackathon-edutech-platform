import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Firma de mensajes entre la app y n8n (prompt §8.2).
 *
 * - `X-Timestamp`: segundos Unix del envío.
 * - `X-Signature`: `sha256=<hex>` = HMAC-SHA256(secreto, `${timestamp}.${cuerpo}`).
 *
 * Se firma el timestamp junto con el cuerpo para que no se pueda reutilizar un cuerpo firmado
 * con otro timestamp; la ventana de 5 minutos limita los reenvíos (docs/DECISIONES.md, D-18).
 */
export const VENTANA_SEGUNDOS = 300;

export function firmar(secreto: string, timestamp: number | string, cuerpo: string): string {
  return `sha256=${createHmac("sha256", secreto).update(`${timestamp}.${cuerpo}`).digest("hex")}`;
}

export function cabecerasFirmadas(secreto: string, cuerpo: string, ahora: Date = new Date()): Record<string, string> {
  const timestamp = Math.floor(ahora.getTime() / 1000);
  return { "X-Timestamp": String(timestamp), "X-Signature": firmar(secreto, timestamp, cuerpo) };
}

export type ResultadoFirma =
  | { ok: true }
  | { ok: false; motivo: "faltan-cabeceras" | "timestamp-invalido" | "fuera-de-ventana" | "firma-invalida" };

export function verificarFirma(opts: {
  secreto: string;
  cuerpo: string;
  timestamp: string | null;
  firma: string | null;
  ahora?: Date;
  ventanaSegundos?: number;
}): ResultadoFirma {
  const { secreto, cuerpo, timestamp, firma } = opts;
  if (!timestamp || !firma) return { ok: false, motivo: "faltan-cabeceras" };
  if (!/^\d{9,11}$/.test(timestamp)) return { ok: false, motivo: "timestamp-invalido" };
  const ahora = Math.floor((opts.ahora ?? new Date()).getTime() / 1000);
  if (Math.abs(ahora - Number(timestamp)) > (opts.ventanaSegundos ?? VENTANA_SEGUNDOS)) return { ok: false, motivo: "fuera-de-ventana" };
  const esperada = Buffer.from(firmar(secreto, timestamp, cuerpo));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return { ok: false, motivo: "firma-invalida" };
  return { ok: true };
}
