"use server";

import { revalidatePath } from "next/cache";
import type { ResultadoAccion } from "@/components/admin/accion";
import { exigirAdmin } from "@/lib/auth/session";
import {
  cambiarEstadoSala,
  controlarCronometro,
  generarOrden,
  guardarJuez,
  guardarSala,
  juezSchema,
  moverSlot,
  prepararTurno,
  publicarAviso,
  salaSchema,
  type AccionCronometro,
  type Ronda,
} from "@/lib/jurado/servicio";
import { log } from "@/lib/log";
import { ErrorRegistro } from "@/lib/registro/servicio";

const RUTA = "/admin/jurado";

async function ejecutar(fn: (uid: string) => Promise<string>): Promise<ResultadoAccion> {
  try {
    const uid = await exigirAdmin(RUTA);
    const mensaje = await fn(uid);
    revalidatePath(RUTA);
    return { ok: true, mensaje };
  } catch (err) {
    if (err instanceof ErrorRegistro) return { ok: false, error: err.message };
    log.error("Error en /admin/jurado", { error: err instanceof Error ? err.message : "desconocido" });
    return { ok: false, error: "No se pudo completar la acción. Inténtalo de nuevo." };
  }
}

export async function crearSala(fd: FormData) {
  return ejecutar(async (uid) => {
    const r = salaSchema.safeParse({ id: fd.get("id"), nombre: fd.get("nombre"), tracks: fd.getAll("tracks") });
    if (!r.success) throw new ErrorRegistro(r.error.issues[0]!.message);
    await guardarSala(r.data, uid);
    return `Sala ${r.data.nombre} guardada.`;
  });
}

export async function crearJuez(fd: FormData) {
  return ejecutar(async (uid) => {
    const r = juezSchema.safeParse({
      email: fd.get("email"),
      nombre: fd.get("nombre"),
      perfil: fd.get("perfil"),
      roomId: fd.get("roomId"),
      final: fd.get("final") === "on",
    });
    if (!r.success) throw new ErrorRegistro(r.error.issues[0]!.message);
    await guardarJuez(r.data, uid);
    return `${r.data.nombre} quedó registrado. Ingresa con su correo en /ingresar.`;
  });
}

export async function generar(ronda: Ronda) {
  return ejecutar(async (uid) => `Orden generado: ${await generarOrden(ronda, uid)} turnos.`);
}

export async function mover(slotId: string, direccion: -1 | 1) {
  return ejecutar(async (uid) => {
    await moverSlot(slotId, direccion, uid);
    return "Orden actualizado.";
  });
}

export async function cerrarSala(roomId: string) {
  return ejecutar(async (uid) => {
    await cambiarEstadoSala(roomId, true, uid);
    return "Sala cerrada: puntajes bloqueados.";
  });
}

export async function reabrirSala(roomId: string, fd: FormData) {
  return ejecutar(async (uid) => {
    await cambiarEstadoSala(roomId, false, uid, String(fd.get("motivo") ?? ""));
    return "Sala reabierta (queda en la auditoría).";
  });
}

export async function turno(slotId: string) {
  return ejecutar(async (uid) => {
    await prepararTurno(slotId, uid);
    return "Equipo en pantalla.";
  });
}

const MENSAJE_CRONOMETRO: Record<AccionCronometro, string> = {
  iniciar: "Cronómetro en marcha.",
  pausar: "Cronómetro en pausa.",
  reiniciar: "Cronómetro en cero.",
  terminar: "Presentación terminada.",
};

export async function cronometro(roomId: string, accion: AccionCronometro) {
  return ejecutar(async (uid) => {
    await controlarCronometro(roomId, accion, uid);
    return MENSAJE_CRONOMETRO[accion];
  });
}

export async function aviso(fd: FormData) {
  return ejecutar(async (uid) => {
    const texto = String(fd.get("aviso") ?? "");
    await publicarAviso(texto, uid);
    return texto.trim() ? "Aviso publicado en /pantalla." : "Aviso retirado.";
  });
}
