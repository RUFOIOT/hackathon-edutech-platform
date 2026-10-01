import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { esStaffRole, puedeEntrarAdmin, type Identidad } from "@/lib/auth/roles";

export const SESSION_COOKIE = "__session"; // Nombre que Netlify/CDN no elimina del caché.
export const SESSION_DAYS = 5;

/** Roles de una cuenta, leídos de staff/, judges/ y participants/. */
export async function identidadDeUid(uid: string): Promise<Identidad> {
  const [staff, judge, participant] = await Promise.all([
    adminDb().doc(`staff/${uid}`).get(),
    adminDb().doc(`judges/${uid}`).get(),
    adminDb().doc(`participants/${uid}`).get(),
  ]);
  const roles: unknown[] = staff.exists ? (staff.get("roles") ?? []) : [];
  return { uid, staffRoles: roles.filter(esStaffRole), esJuez: judge.exists, esParticipante: participant.exists };
}

/**
 * Lee y verifica la cookie de sesión de Firebase (firmada por Google, revocable).
 * `cache` evita verificarla varias veces en un mismo render.
 */
export const getIdentidad = cache(async (): Promise<Identidad | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(token, true);
    return await identidadDeUid(decoded.uid);
  } catch {
    // Cookie vencida, revocada o manipulada: se trata como sin sesión.
    return null;
  }
});

export async function requireSesion(destino: string): Promise<Identidad> {
  const id = await getIdentidad();
  if (!id) redirect(`/ingresar?siguiente=${encodeURIComponent(destino)}`);
  return id;
}

export async function requireAdmin(ruta: string): Promise<Identidad> {
  const id = await requireSesion(ruta);
  if (!puedeEntrarAdmin(id, ruta)) redirect("/sin-acceso");
  return id;
}

/** Para Server Actions de /admin: devuelve el uid o lanza un error legible (no redirige). */
export async function exigirAdmin(ruta: string): Promise<string> {
  const id = await getIdentidad();
  if (!id || !puedeEntrarAdmin(id, ruta)) {
    const { ErrorRegistro } = await import("@/lib/registro/servicio");
    throw new ErrorRegistro("No tienes permiso para esta acción o tu sesión expiró.");
  }
  return id.uid;
}

export async function requireJuez(ruta: string): Promise<Identidad> {
  const id = await requireSesion(ruta);
  if (!id.esJuez) redirect("/sin-acceso");
  return id;
}
