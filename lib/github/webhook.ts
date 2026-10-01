import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica la cabecera X-Hub-Signature-256 de un webhook de GitHub:
 * `sha256=` + HMAC-SHA256(secreto, cuerpo crudo) en hex. Comparación en tiempo constante.
 */
export function verificarFirmaGithub(secreto: string, cuerpo: string, cabecera: string | null): boolean {
  if (!secreto || !cabecera?.startsWith("sha256=")) return false;
  const esperada = Buffer.from(`sha256=${createHmac("sha256", secreto).update(cuerpo).digest("hex")}`);
  const recibida = Buffer.from(cabecera);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

export interface MovimientoTag {
  repo: string; // owner/name
  accion: "creado" | "movido" | "eliminado";
  sha: string | null;
}

/**
 * Extrae un movimiento del tag de entrega de un evento `push`, `create` o `delete`.
 * Devuelve null si el evento no toca ese tag.
 */
export function movimientoDeTag(evento: string, payload: Record<string, unknown>, tag: string): MovimientoTag | null {
  const repo = (payload.repository as { full_name?: string } | undefined)?.full_name;
  if (!repo) return null;
  if (evento === "push" && payload.ref === `refs/tags/${tag}`) {
    if (payload.deleted === true) return { repo, accion: "eliminado", sha: null };
    return { repo, accion: payload.created === true ? "creado" : "movido", sha: (payload.after as string) ?? null };
  }
  if ((evento === "create" || evento === "delete") && payload.ref_type === "tag" && payload.ref === tag) {
    return { repo, accion: evento === "create" ? "creado" : "eliminado", sha: null };
  }
  return null;
}
