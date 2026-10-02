import "server-only";
import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { headers } from "next/headers";
import { adminDb } from "@/lib/firebase/admin";
import { log } from "@/lib/log";

/**
 * Límite de peticiones por ventana fija (D-41). En Netlify cada función es efímera, así que el
 * conteo vive en Firestore: `rate_limits/{nombre}_{hash}_{ventana}`. La IP nunca se guarda en
 * claro: se usa un hash con sal. Los documentos tienen `expiraAt` para la política TTL de
 * Firestore (docs/DEPLOY.md).
 *
 * Los límites por IP son holgados a propósito: en el colegio decenas de estudiantes salen a
 * internet con la misma IP. Lo fino se limita por cuenta (uid).
 */
export const LIMITES = {
  sesion: { max: 120, ventanaSeg: 600 },
  tokenCliente: { max: 60, ventanaSeg: 600 },
  registroPaso: { max: 60, ventanaSeg: 600 },
  registroConfirmar: { max: 5, ventanaSeg: 600 },
  registroIp: { max: 150, ventanaSeg: 600 },
  unirse: { max: 10, ventanaSeg: 600 },
  invitar: { max: 30, ventanaSeg: 3600 },
  misDatos: { max: 10, ventanaSeg: 3600 },
  eliminacion: { max: 3, ventanaSeg: 86_400 },
} as const;
export type NombreLimite = keyof typeof LIMITES;

export type ResultadoLimite = { ok: true } | { ok: false; reintentarEnSeg: number };

/** Ventana fija actual y segundos que faltan para la siguiente. */
export function ventana(ahoraMs: number, ventanaSeg: number): { indice: number; restanSeg: number } {
  const seg = Math.floor(ahoraMs / 1000);
  const indice = Math.floor(seg / ventanaSeg);
  return { indice, restanSeg: (indice + 1) * ventanaSeg - seg };
}

export function hashClave(valor: string): string {
  const sal = process.env.HASH_SALT ?? "edutech-2026";
  return createHash("sha256").update(`${sal}:${valor}`).digest("hex").slice(0, 32);
}

/** IP del cliente: la que pone el edge de Netlify; en local, la primera de X-Forwarded-For. */
export function ipDe(h: Headers): string {
  return h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "desconocida";
}

export async function ipActual(): Promise<string> {
  return ipDe(await headers());
}

/**
 * Suma un intento a `clave` en el límite `nombre`. Si Firestore falla, deja pasar (un fallo del
 * limitador no debe impedir inscribirse) y lo registra.
 */
export async function limitar(nombre: NombreLimite, clave: string, ahora: Date = new Date()): Promise<ResultadoLimite> {
  const { max, ventanaSeg } = LIMITES[nombre];
  const v = ventana(ahora.getTime(), ventanaSeg);
  const ref = adminDb().doc(`rate_limits/${nombre}_${hashClave(clave)}_${v.indice}`);
  try {
    const n = await adminDb().runTransaction(async (tx) => {
      const actual = Number((await tx.get(ref)).get("n") ?? 0);
      if (actual >= max) return actual + 1;
      tx.set(ref, { n: FieldValue.increment(1), expiraAt: Timestamp.fromMillis(ahora.getTime() + (v.restanSeg + 60) * 1000) }, { merge: true });
      return actual + 1;
    });
    return n > max ? { ok: false, reintentarEnSeg: v.restanSeg } : { ok: true };
  } catch (err) {
    log.warn("Limitador no disponible", { nombre, error: err instanceof Error ? err.message : "desconocido" });
    return { ok: true };
  }
}

export function mensajeLimite(r: { reintentarEnSeg: number }): string {
  const min = Math.max(1, Math.ceil(r.reintentarEnSeg / 60));
  return `Demasiados intentos seguidos. Espera ${min} ${min === 1 ? "minuto" : "minutos"} y vuelve a intentarlo.`;
}
