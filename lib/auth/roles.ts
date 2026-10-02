/** Roles de staff (prompt §7, tabla staff). Una persona puede tener varios. */
export const STAFF_ROLES = ["admin", "comite", "mesa_tecnica", "checkin", "mentor"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface Identidad {
  uid: string;
  staffRoles: StaffRole[];
  esJuez: boolean;
  esParticipante: boolean;
}

/** Secciones de /admin y qué roles pueden entrar. Espeja firestore.rules. */
export const ACCESO_ADMIN: Record<string, readonly StaffRole[]> = {
  "/admin": ["admin", "comite", "mesa_tecnica"],
  "/admin/participantes": ["admin", "comite", "mesa_tecnica"],
  "/admin/equipos": ["admin", "comite", "mesa_tecnica"],
  "/admin/repositorios": ["admin", "comite", "mesa_tecnica"],
  "/admin/checkin": ["admin", "comite", "mesa_tecnica", "checkin"],
  "/admin/jurado": ["admin", "comite"],
  "/admin/resultados": ["admin", "comite"],
  "/admin/comunicados": ["admin", "comite"],
  "/admin/auditoria": ["admin", "comite"],
  "/admin/privacidad": ["admin"],
  "/admin/organizacion": ["admin"],
  "/admin/mentoria": ["admin", "comite", "mesa_tecnica", "mentor"],
};

export function tieneRol(id: Pick<Identidad, "staffRoles">, ...roles: StaffRole[]): boolean {
  return id.staffRoles.some((r) => roles.includes(r));
}

/** Resuelve el acceso a una ruta de /admin usando el prefijo más largo que coincida. */
export function puedeEntrarAdmin(id: Pick<Identidad, "staffRoles">, ruta: string): boolean {
  const clave = Object.keys(ACCESO_ADMIN)
    .filter((k) => ruta === k || ruta.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (!clave) return false;
  return tieneRol(id, ...(ACCESO_ADMIN[clave] ?? []));
}

/** Destino tras iniciar sesión según el rol. */
export function inicioPara(id: Identidad): string {
  if (tieneRol(id, "admin", "comite", "mesa_tecnica")) return "/admin";
  if (tieneRol(id, "checkin")) return "/admin/checkin";
  if (id.esJuez) return "/jurado";
  if (tieneRol(id, "mentor")) return "/admin/mentoria";
  if (id.esParticipante) return "/mi-equipo";
  return "/registro";
}

/**
 * Valida el parámetro `siguiente` para evitar redirecciones abiertas:
 * solo rutas internas absolutas ("/mi-equipo"), nunca "//dominio" ni URLs completas.
 */
export function destinoSeguro(x: unknown): string | null {
  if (typeof x !== "string") return null;
  if (!x.startsWith("/") || x.startsWith("//") || x.includes("\\")) return null;
  return /^\/[\w\-/[\]]*$/.test(x) ? x : null;
}

export function esStaffRole(x: unknown): x is StaffRole {
  return typeof x === "string" && (STAFF_ROLES as readonly string[]).includes(x);
}
