"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { EVENT, ROLES_EQUIPO, fecha } from "@/config/event";
import { auditarEn } from "@/lib/audit";
import { getIdentidad } from "@/lib/auth/session";
import { despachar, encolarEn } from "@/lib/eventos";
import { ahora } from "@/lib/event/reloj";
import { adminDb } from "@/lib/firebase/admin";
import { invitacionesPermitidas } from "@/lib/registro/reglas";
import { ErrorRegistro, invitacionId, unirseConCodigo } from "@/lib/registro/servicio";
import { limitar, mensajeLimite, type NombreLimite } from "@/lib/seguridad/limite";
import { CODIGO_INVITACION } from "@/lib/validation/registro";

export type Respuesta = { ok: true; mensaje: string } | { ok: false; error: string };

async function participante() {
  const id = await getIdentidad();
  if (!id?.esParticipante) throw new ErrorRegistro("Tu sesión expiró. Vuelve a ingresar.");
  const p = await adminDb().doc(`participants/${id.uid}`).get();
  return { uid: id.uid, p };
}

async function exigirLimite(nombre: NombreLimite, uid: string) {
  const r = await limitar(nombre, uid);
  if (!r.ok) throw new ErrorRegistro(mensajeLimite(r));
}

async function ejecutar(fn: () => Promise<string>): Promise<Respuesta> {
  try {
    const mensaje = await fn();
    revalidatePath("/mi-equipo");
    return { ok: true, mensaje };
  } catch (err) {
    if (err instanceof ErrorRegistro) return { ok: false, error: err.message };
    return { ok: false, error: "No pudimos guardar el cambio. Inténtalo de nuevo en un minuto." };
  }
}

/** Cada integrante elige su propio rol (Guía del Hacker §3: los roles no son exclusivos). */
export async function cambiarMiRol(rol: string): Promise<Respuesta> {
  return ejecutar(async () => {
    const r = z.enum(ROLES_EQUIPO).safeParse(rol);
    if (!r.success) throw new ErrorRegistro("Elige un rol de la lista.");
    const { uid, p } = await participante();
    const teamId = p.get("teamId") as string | null;
    if (!teamId) throw new ErrorRegistro("Aún no tienes equipo.");
    const ref = adminDb().doc(`team_members/${teamId}_${uid}`);
    const antes = (await ref.get()).get("rol");
    const batch = adminDb().batch();
    batch.update(ref, { rol: r.data });
    auditarEn(batch, { actor: uid, accion: "team.role", entidad: "team_members", entidadId: ref.id, antes: { rol: antes }, despues: { rol: r.data } });
    await batch.commit();
    return "Rol actualizado.";
  });
}

/** El capitán puede cambiar el track hasta el checkpoint 1 (Guía del Hacker §10). */
export async function cambiarTrack(track: string): Promise<Respuesta> {
  return ejecutar(async () => {
    const r = z.enum(["T1", "T2", "T3"]).safeParse(track);
    if (!r.success) throw new ErrorRegistro("Elige un track de la lista.");
    if (ahora() >= fecha("checkpoint1")) throw new ErrorRegistro("El track solo se puede cambiar hasta el checkpoint 1 (viernes 19:00).");
    const { uid, p } = await participante();
    const teamRef = adminDb().doc(`teams/${p.get("teamId")}`);
    const team = await teamRef.get();
    if (!team.exists || team.get("capitanId") !== uid) throw new ErrorRegistro("Solo el capitán del equipo puede cambiar el track.");
    const batch = adminDb().batch();
    batch.update(teamRef, { track: r.data });
    auditarEn(batch, { actor: uid, accion: "team.track", entidad: "teams", entidadId: team.id, antes: { track: team.get("track") }, despues: { track: r.data } });
    await batch.commit();
    return `Track cambiado a ${r.data}.`;
  });
}

/** El capitán invita a más personas mientras el equipo tenga lugar (máximo 5 contando invitaciones). */
export async function invitar(correo: string): Promise<Respuesta> {
  return ejecutar(async () => {
    const r = z.email().safeParse(correo.trim());
    if (!r.success) throw new ErrorRegistro("Escribe un correo válido.");
    const email = r.data.toLowerCase();
    const { uid, p } = await participante();
    await exigirLimite("invitar", uid);
    const teamRef = adminDb().doc(`teams/${p.get("teamId")}`);
    const team = await teamRef.get();
    if (!team.exists || team.get("capitanId") !== uid) throw new ErrorRegistro("Solo el capitán puede invitar integrantes.");
    if (email === p.get("email")) throw new ErrorRegistro("Ese es tu propio correo.");
    const pendientes = await adminDb().collection("invitations").where("teamId", "==", team.id).where("estado", "==", "pendiente").count().get();
    if (invitacionesPermitidas(team.get("miembros") ?? 0, pendientes.data().count) === 0) {
      throw new ErrorRegistro(`El equipo ya llega a ${EVENT.equipo.max} personas contando las invitaciones pendientes.`);
    }
    const batch = adminDb().batch();
    const invRef = adminDb().doc(`invitations/${invitacionId(team.id, email)}`);
    batch.set(invRef, { teamId: team.id, email, estado: "pendiente", invitadoPor: uid, creadaAt: FieldValue.serverTimestamp() });
    const evento = encolarEn(batch, "team.invitation", {
      teamId: team.id,
      teamNombre: team.get("nombre"),
      track: team.get("track"),
      correo: email,
      codigo: team.get("codigoInvitacion"),
      enlace: `${process.env.APP_BASE_URL ?? ""}/registro?codigo=${team.get("codigoInvitacion")}`,
      invitadoPor: `${p.get("nombres")} ${p.get("apellidos")}`,
    });
    auditarEn(batch, { actor: uid, accion: "team.invite", entidad: "invitations", entidadId: invRef.id });
    await batch.commit();
    await despachar([evento]);
    return `Invitación enviada a ${email}.`;
  });
}

/** Quien está sin equipo (matchmaking) puede unirse con un código. */
export async function unirme(codigo: string): Promise<Respuesta> {
  return ejecutar(async () => {
    const c = codigo.trim().toUpperCase();
    if (!CODIGO_INVITACION.test(c)) throw new ErrorRegistro("El código tiene 6 caracteres (letras y números).");
    const { uid } = await participante();
    await exigirLimite("unirse", uid);
    const r = await unirseConCodigo(uid, c);
    return `Te uniste al equipo ${r.teamNombre}.`;
  });
}

/** Derecho de eliminación (LOPDP): se registra la solicitud; el comité la ejecuta y responde. */
export async function solicitarEliminacion(): Promise<Respuesta> {
  return ejecutar(async () => {
    const { uid } = await participante();
    await exigirLimite("eliminacion", uid);
    const ref = adminDb().doc(`data_requests/${uid}_eliminacion`);
    const batch = adminDb().batch();
    batch.set(ref, { participantId: uid, tipo: "eliminacion", estado: "pendiente", creadaAt: FieldValue.serverTimestamp() });
    auditarEn(batch, { actor: uid, accion: "data.delete_request", entidad: "data_requests", entidadId: ref.id });
    await batch.commit();
    return "Recibimos tu solicitud de eliminación. El comité la atenderá y te escribirá en un plazo máximo de 15 días.";
  });
}
