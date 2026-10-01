"use server";

import { revalidatePath } from "next/cache";
import { contextoEquipo } from "@/lib/equipo/contexto";
import { entregaAbierta, enviarEntrega, prepararSubidaPitch, subirPitchPorServidor } from "@/lib/entrega/servicio";
import { log } from "@/lib/log";
import { ErrorRegistro } from "@/lib/registro/servicio";
import { erroresPorCampo } from "@/lib/validation/registro";
import { entregaSchema, validarPitch } from "@/lib/validation/entrega";

type Fallo = { ok: false; errores: Record<string, string> };
const fallo = (mensaje: string, campo = "_"): Fallo => ({ ok: false, errores: { [campo]: mensaje } });

function manejar(err: unknown): Fallo {
  if (err instanceof ErrorRegistro) return fallo(err.message, err.campo);
  log.error("Error en la entrega", { error: err instanceof Error ? err.message : "desconocido" });
  return fallo("No pudimos completar la operación por un error nuestro. Inténtalo de nuevo; si falla, avisa a la mesa técnica.");
}

/** Paso 1 de la subida del pitch: URL firmada (producción) o subida por el servidor (emuladores). */
export async function iniciarSubidaPitch(): Promise<
  { ok: true; modo: "firmada"; url: string; cabeceras: Record<string, string> } | { ok: true; modo: "servidor" } | Fallo
> {
  try {
    const { teamId } = await contextoEquipo();
    if (!entregaAbierta()) return fallo("El formulario de entrega cerró a las 12:00 del sábado (code freeze).");
    return { ok: true, ...(await prepararSubidaPitch(teamId)) };
  } catch (err) {
    return manejar(err);
  }
}

/** Solo con emuladores (D-25): el PDF llega en la Server Action. */
export async function subirPitch(fd: FormData): Promise<{ ok: true } | Fallo> {
  try {
    const { teamId } = await contextoEquipo();
    const f = fd.get("pitch");
    if (!(f instanceof File)) return fallo("Adjunta el PDF del pitch.", "pitch");
    const e = validarPitch(f.name, f.type, f.size);
    if (e) return fallo(e, "pitch");
    await subirPitchPorServidor(teamId, new Uint8Array(await f.arrayBuffer()));
    return { ok: true };
  } catch (err) {
    return manejar(err);
  }
}

export type RespuestaEntrega = { ok: true; tagSha: string; tagCommitAt: string } | Fallo;

export async function entregar(datos: unknown): Promise<RespuestaEntrega> {
  try {
    const { uid, teamId } = await contextoEquipo();
    const r = entregaSchema.safeParse(datos);
    if (!r.success) return { ok: false, errores: erroresPorCampo(r.error) };
    const res = await enviarEntrega(uid, teamId, r.data);
    revalidatePath("/mi-equipo/entrega");
    return { ok: true, tagSha: res.tagSha, tagCommitAt: res.tagCommitAt.toISOString() };
  } catch (err) {
    return manejar(err);
  }
}
