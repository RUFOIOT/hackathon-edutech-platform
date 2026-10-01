import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token del QR personal de check-in: `EDT1.<uid>.<firma>`. La firma (HMAC truncado a 128 bits)
 * impide fabricar el QR de otra persona conociendo solo su uid. No contiene datos personales.
 */
const PREFIJO = "EDT1";

function firma(secreto: string, uid: string): string {
  return createHmac("sha256", secreto).update(`checkin:${uid}`).digest("base64url").slice(0, 22);
}

export function tokenQr(secreto: string, uid: string): string {
  if (!/^[\w-]{1,128}$/.test(uid)) throw new Error("uid inválido para el QR");
  return `${PREFIJO}.${uid}.${firma(secreto, uid)}`;
}

/** Devuelve el uid si el token es auténtico; null si fue alterado o no tiene el formato. */
export function verificarTokenQr(secreto: string, token: string): string | null {
  const partes = token.trim().split(".");
  if (partes.length !== 3 || partes[0] !== PREFIJO) return null;
  const [, uid, recibida] = partes as [string, string, string];
  if (!/^[\w-]{1,128}$/.test(uid)) return null;
  const esperada = Buffer.from(firma(secreto, uid));
  const dada = Buffer.from(recibida);
  return esperada.length === dada.length && timingSafeEqual(esperada, dada) ? uid : null;
}
