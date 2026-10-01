"use server";

import { revalidatePath } from "next/cache";
import { getIdentidad } from "@/lib/auth/session";
import { declararConflicto, guardarPuntaje, puntajeSchema } from "@/lib/jurado/servicio";
import { log } from "@/lib/log";
import { ErrorRegistro } from "@/lib/registro/servicio";
import { erroresPorCampo } from "@/lib/validation/registro";

type Fallo = { ok: false; errores: Record<string, string> };
const fallo = (m: string): Fallo => ({ ok: false, errores: { _: m } });

async function juez(): Promise<string> {
  const id = await getIdentidad();
  if (!id?.esJuez) throw new ErrorRegistro("Tu sesión expiró. Vuelve a ingresar.");
  return id.uid;
}

function manejar(err: unknown): Fallo {
  if (err instanceof ErrorRegistro) return fallo(err.message);
  log.error("Error en la evaluación", { error: err instanceof Error ? err.message : "desconocido" });
  return fallo("No pudimos guardar. Revisa tu conexión e inténtalo de nuevo; tus respuestas siguen en pantalla.");
}

export async function enviarPuntaje(teamId: string, datos: unknown): Promise<{ ok: true; total: number } | Fallo> {
  try {
    const uid = await juez();
    const r = puntajeSchema.safeParse(datos);
    if (!r.success) return { ok: false, errores: erroresPorCampo(r.error) };
    const total = await guardarPuntaje(uid, teamId, r.data);
    revalidatePath("/jurado");
    return { ok: true, total };
  } catch (err) {
    return manejar(err);
  }
}

export async function enviarConflicto(teamId: string, motivo: string): Promise<{ ok: true } | Fallo> {
  try {
    await declararConflicto(await juez(), teamId, motivo);
    revalidatePath("/jurado");
    return { ok: true };
  } catch (err) {
    return manejar(err);
  }
}
