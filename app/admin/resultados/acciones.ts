"use server";

import { revalidatePath } from "next/cache";
import type { ResultadoAccion } from "@/components/admin/accion";
import { exigirAdmin } from "@/lib/auth/session";
import { publicarResultados } from "@/lib/jurado/servicio";
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

export async function publicar(fd: FormData) {
  return ejecutar(async (uid) => {
    if (fd.get("revisado") !== "on") throw new ErrorRegistro("Confirma que el comité revisó el ranking, los desempates y los premios.");
    const elegido = (k: string) => String(fd.get(k) ?? "").trim() || null;
    await publicarResultados({ primeroOpen: elegido("primeroOpen"), segundoOpen: elegido("segundoOpen"), mejorJunior: elegido("mejorJunior") }, uid);
    return "Resultados publicados. Los equipos ya los ven y n8n enviará los certificados.";
  });
}
