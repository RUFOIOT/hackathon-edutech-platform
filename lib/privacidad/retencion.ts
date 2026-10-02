import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { EVENT, fecha } from "@/config/event";
import { auditarEn } from "@/lib/audit";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase/admin";
import { log } from "@/lib/log";
import type { Categoria } from "@/lib/models/categoria";
import { estadoEquipo } from "@/lib/registro/reglas";

/**
 * Política de retención y derecho de eliminación (LOPDP, D-43).
 *
 * Anonimizar = borrar o sobrescribir todo dato que identifique a la persona y conservar solo lo
 * que alimenta las estadísticas del evento (categoría, nivel, ciudad, perfil técnico, equipo).
 * Se borran: autorización del representante (documento y archivo), cuenta de acceso, borrador,
 * invitaciones y la IP de los consentimientos (el registro de qué versión aceptó se conserva).
 */

export const MOTIVOS = ["solicitud", "retencion"] as const;
export type MotivoAnonimizacion = (typeof MOTIVOS)[number];

export function mesesRetencion(): number {
  const n = Number(process.env.RETENCION_MESES);
  return Number.isInteger(n) && n > 0 ? n : EVENT.retencionMeses;
}

/** Fecha desde la que se anonimiza todo: fin del evento (premiación) + meses de retención. */
export function fechaRetencion(meses = mesesRetencion()): Date {
  const d = new Date(fecha("premiacion"));
  d.setUTCMonth(d.getUTCMonth() + meses);
  return d;
}

/** Campos del participante tras anonimizar. Lo que no aparece aquí se conserva. */
export function camposAnonimos(motivo: MotivoAnonimizacion): Record<string, unknown> {
  return {
    nombres: "Participante anonimizado",
    apellidos: "",
    email: null,
    celular: null,
    fechaNacimiento: null,
    institucion: null,
    githubUsername: null,
    talla: null,
    restriccionesAlimentarias: null,
    accesibilidad: null,
    solicitudEquipo: null,
    anonimizado: true,
    motivoAnonimizacion: motivo,
  };
}

const db = () => adminDb();

/**
 * Anonimiza a una persona. Si lo pide antes del kick-off, además sale de su equipo (libera el
 * cupo y el equipo recalcula su estado); después del evento se conserva la pertenencia histórica.
 */
export async function anonimizarParticipante(uid: string, opts: { actor: string; motivo: MotivoAnonimizacion; ahora: Date }): Promise<{ salioDeEquipo: boolean }> {
  const pRef = db().doc(`participants/${uid}`);
  const antesDelEvento = opts.ahora < fecha("kickoff");
  let salioDeEquipo = false;
  let email: string | null = null;

  await db().runTransaction(async (tx) => {
    salioDeEquipo = false;
    const p = await tx.get(pRef);
    if (!p.exists) throw new Error("Participante inexistente");
    if (p.get("anonimizado")) return;
    email = (p.get("email") as string) ?? null;
    const teamId = p.get("teamId") as string | null;
    const miembros = await tx.get(db().collection("team_members").where("participantId", "==", uid));
    const team = teamId ? await tx.get(db().doc(`teams/${teamId}`)) : null;
    const companeros = teamId && antesDelEvento ? await tx.get(db().collection("team_members").where("teamId", "==", teamId)) : null;

    const update: Record<string, unknown> = { ...camposAnonimos(opts.motivo), anonimizadoAt: FieldValue.serverTimestamp() };
    if (team?.exists && antesDelEvento) {
      salioDeEquipo = true;
      const n = Math.max(0, Number(team.get("miembros") ?? 1) - 1);
      const conteo = { ...(team.get("conteoCategorias") as Record<Categoria, number>) };
      const cat = p.get("categoria") as Categoria;
      conteo[cat] = Math.max(0, (conteo[cat] ?? 1) - 1);
      const otro = companeros?.docs.find((m) => m.get("participantId") !== uid);
      tx.update(team.ref, {
        miembros: n,
        estado: estadoEquipo(n),
        conteoCategorias: conteo,
        requiereAdulto: (conteo.JUNIOR ?? 0) > 0,
        ...(team.get("capitanId") === uid && otro ? { capitanId: otro.get("participantId") } : {}),
      });
      if (team.get("capitanId") === uid && otro) tx.update(otro.ref, { esCapitan: true });
      miembros.docs.forEach((m) => tx.delete(m.ref));
      update.teamId = null;
      if (!p.get("enListaEspera")) tx.set(db().doc("stats/inscripciones"), { personas: FieldValue.increment(-1) }, { merge: true });
    } else {
      miembros.docs.forEach((m) => tx.update(m.ref, { nombre: "Participante anonimizado", githubUsername: null }));
    }
    tx.update(pRef, update);
    tx.delete(db().doc(`guardians/${uid}`));
    tx.delete(db().doc(`registration_drafts/${uid}`));
    tx.set(
      db().doc(`data_requests/${uid}_eliminacion`),
      { participantId: uid, tipo: "eliminacion", estado: "atendida", atendidaAt: FieldValue.serverTimestamp(), atendidaPor: opts.actor, motivo: opts.motivo },
      { merge: true },
    );
    auditarEn(tx, { actor: opts.actor, accion: "participant.anonymize", entidad: "participants", entidadId: uid, despues: { motivo: opts.motivo, salioDeEquipo } });
  });

  // Fuera de la transacción: Storage, Auth y colecciones por consulta. Son idempotentes.
  const [archivos] = await adminStorage()
    .bucket()
    .getFiles({ prefix: `autorizaciones/${uid}` })
    .catch(() => [[]] as [never[]]);
  await Promise.all(archivos.map((f) => f.delete({ ignoreNotFound: true }).catch(() => undefined)));
  await adminAuth()
    .deleteUser(uid)
    .catch(() => undefined);
  const consents = await db().collection("consents").where("participantId", "==", uid).get();
  const invitaciones = email ? await db().collection("invitations").where("email", "==", email).get() : null;
  const lote = db().batch();
  consents.docs.forEach((c) => lote.update(c.ref, { ip: null }));
  invitaciones?.docs.forEach((i) => lote.delete(i.ref));
  await lote.commit();
  return { salioDeEquipo };
}

/** Borra todos los documentos de una colección (en lotes de 400). */
async function vaciar(coleccion: string): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await db().collection(coleccion).limit(400).get();
    if (snap.empty) return total;
    const lote = db().batch();
    snap.docs.forEach((d) => lote.delete(d.ref));
    await lote.commit();
    total += snap.size;
  }
}

/** Personas aún no anonimizadas (lo que haría `aplicarRetencion`). */
export async function pendientesDeRetencion(): Promise<number> {
  const snap = await db().collection("participants").select("anonimizado").get();
  return snap.docs.filter((d) => !d.get("anonimizado")).length;
}

/**
 * Aplica la política de retención: anonimiza a todos y vacía las colecciones operativas que
 * guardan correos (outbox de eventos, invitaciones, borradores) o hashes de IP (límites).
 */
export async function aplicarRetencion(opts: { actor: string; ahora: Date }): Promise<{ anonimizados: number; borrados: Record<string, number> }> {
  if (opts.ahora < fechaRetencion()) throw new Error("La política de retención aún no vence.");
  const snap = await db().collection("participants").select("anonimizado").get();
  let anonimizados = 0;
  for (const d of snap.docs) {
    if (d.get("anonimizado")) continue;
    try {
      await anonimizarParticipante(d.id, { actor: opts.actor, motivo: "retencion", ahora: opts.ahora });
      anonimizados++;
    } catch (err) {
      log.error("No se pudo anonimizar", { uid: d.id, error: err instanceof Error ? err.message : "desconocido" });
    }
  }
  const borrados: Record<string, number> = {};
  for (const c of ["event_outbox", "invitations", "registration_drafts", "rate_limits"]) borrados[c] = await vaciar(c);
  const lote = db().batch();
  auditarEn(lote, { actor: opts.actor, accion: "retention.apply", entidad: "participants", entidadId: "todos", despues: { anonimizados, ...borrados } });
  await lote.commit();
  return { anonimizados, borrados };
}
