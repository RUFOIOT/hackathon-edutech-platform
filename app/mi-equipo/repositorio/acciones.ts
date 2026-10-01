"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fecha } from "@/config/event";
import type { Chequeo } from "@/lib/github";
import { registrarRepositorio, tomarSnapshot } from "@/lib/github/servicio";
import { contextoEquipo } from "@/lib/equipo/contexto";
import { ahora } from "@/lib/event/reloj";
import { adminDb } from "@/lib/firebase/admin";
import { log } from "@/lib/log";
import { ErrorRegistro } from "@/lib/registro/servicio";

export type RespuestaRepo = { ok: true; valido: boolean; chequeos: Chequeo[] } | { ok: false; error: string };

export async function registrar(url: string): Promise<RespuestaRepo> {
  try {
    const { uid, teamId } = await contextoEquipo();
    if (ahora() < fecha("kickoff")) throw new ErrorRegistro("Los repositorios se crean y registran desde el kick-off (viernes 15:30).");
    const r = z.string().trim().min(1, "Pega la URL de tu repositorio.").max(200).safeParse(url);
    if (!r.success) throw new ErrorRegistro(r.error.issues[0]!.message);
    const v = await registrarRepositorio(teamId, r.data, uid);
    if (v.valido) await tomarSnapshot(teamId).catch(() => null); // primeras métricas, sin bloquear el registro
    revalidatePath("/mi-equipo/repositorio");
    return { ok: true, valido: v.valido, chequeos: v.chequeos };
  } catch (err) {
    if (err instanceof ErrorRegistro) return { ok: false, error: err.message };
    log.error("Error al registrar repositorio", { error: err instanceof Error ? err.message : "desconocido" });
    return { ok: false, error: "No pudimos consultar GitHub en este momento. Inténtalo en un minuto." };
  }
}

/** Actualiza las métricas a pedido del equipo, como máximo cada 5 minutos (cuida la cuota de GitHub). */
export async function actualizarMetricas(): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const { teamId } = await contextoEquipo();
    const repo = await adminDb().doc(`repositories/${teamId}`).get();
    const ultimo = repo.get("ultimoSnapshot.tomadoEn")?.toDate?.() as Date | undefined;
    if (ultimo && ahora().getTime() - ultimo.getTime() < 5 * 60_000) {
      return { ok: false, mensaje: "Las métricas se actualizaron hace menos de 5 minutos. La plataforma las lee sola cada 15." };
    }
    await tomarSnapshot(teamId);
    revalidatePath("/mi-equipo/repositorio");
    return { ok: true, mensaje: "Métricas actualizadas." };
  } catch (err) {
    if (err instanceof ErrorRegistro) return { ok: false, mensaje: err.message };
    return { ok: false, mensaje: "No pudimos consultar GitHub en este momento. Inténtalo en un minuto." };
  }
}
