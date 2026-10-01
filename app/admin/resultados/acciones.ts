"use server";

import { revalidatePath } from "next/cache";
import type { ResultadoAccion } from "@/components/admin/accion";
import { exigirAdmin } from "@/lib/auth/session";
import { confirmarFinalistas, publicarResultados } from "@/lib/jurado/servicio";
import { log } from "@/lib/log";
import { ErrorRegistro } from "@/lib/registro/servicio";

const RUTA = "/admin/resultados";

async function ejecutar(fn: (uid: string) => Promise<string>): Promise<ResultadoAccion> {
  try {
    const uid = await exigirAdmin(RUTA);
    const mensaje = await fn(uid);
    revalidatePath(RUTA);
    revalidatePath("/resultados");
    return { ok: true, mensaje };
  } catch (err) {
    if (err instanceof ErrorRegistro) return { ok: false, error: err.message };
    log.error("Error en /admin/resultados", { error: err instanceof Error ? err.message : "desconocido" });
    return { ok: false, error: "No se pudo completar la acción. Inténtalo de nuevo." };
  }
}

export async function finalistas(fd: FormData) {
  return ejecutar(async (uid) => {
    const ids = fd.getAll("finalista").map(String);
    await confirmarFinalistas(ids, uid);
    return `Finalistas confirmados (${ids.length}). La ronda final está abierta y su orden generado.`;
  });
}

export async function publicar(fd: FormData) {
  return ejecutar(async (uid) => {
    if (fd.get("revisado") !== "on") throw new ErrorRegistro("Confirma que el comité revisó el ranking y los premios.");
    // Posiciones elegidas por el comité (permite resolver empates por votación del jurado).
    const posiciones = [...fd.entries()].filter(([k]) => k.startsWith("pos_")).map(([k, v]) => ({ teamId: k.slice(4), pos: Number(v) }));
    if (new Set(posiciones.map((p) => p.pos)).size !== posiciones.length) throw new ErrorRegistro("Hay posiciones repetidas en el orden final.");
    const orden = posiciones.sort((a, b) => a.pos - b.pos).map((p) => p.teamId);
    await publicarResultados(orden, fd.getAll("aceleradora").map(String), uid);
    return "Resultados publicados. Los equipos ya los ven y n8n enviará los certificados.";
  });
}
