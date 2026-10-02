"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { EVENT, MENTORIA_TEMAS, fecha } from "@/config/event";
import type { ResultadoAccion } from "@/components/admin/accion";
import { auditarEn } from "@/lib/audit";
import { tieneRol } from "@/lib/auth/roles";
import { exigirAdmin, getIdentidad } from "@/lib/auth/session";
import { verificarTokenQr } from "@/lib/checkin/qr";
import { despachar, encolarEn } from "@/lib/eventos";
import { ahora } from "@/lib/event/reloj";
import { adminDb } from "@/lib/firebase/admin";
import { tomarSnapshot } from "@/lib/github/servicio";
import { log } from "@/lib/log";
import { categoriaEquipo, type Categoria } from "@/lib/models/categoria";
import type { Evento } from "@/lib/n8n";
import { anonimizarParticipante, aplicarRetencion, fechaRetencion } from "@/lib/privacidad/retencion";
import { estadoEquipo, generarCodigo, slugEquipo } from "@/lib/registro/reglas";
import { ErrorRegistro, unirseConCodigo } from "@/lib/registro/servicio";

/**
 * Acciones de operación del evento (/admin/* y mentoría). Cada una exige el rol de su sección
 * (lib/auth/roles.ts), audita y, si corresponde, emite el evento a n8n por el outbox.
 */

const db = () => adminDb();

async function ejecutar(ruta: string, fn: (uid: string) => Promise<string>, revalidar: string[] = [ruta]): Promise<ResultadoAccion> {
  try {
    const uid = await exigirAdmin(ruta);
    const mensaje = await fn(uid);
    revalidar.forEach((r) => revalidatePath(r));
    return { ok: true, mensaje };
  } catch (err) {
    if (err instanceof ErrorRegistro) return { ok: false, error: err.message };
    log.error("Error en acción de administración", { ruta, error: err instanceof Error ? err.message : "desconocido" });
    return { ok: false, error: "No se pudo completar la acción. Inténtalo de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Participantes
// ---------------------------------------------------------------------------

/** Valida o rechaza la autorización de un Junior. Solo admin y comité (datos de representantes). */
export async function decidirAutorizacion(participantId: string, decision: "validado" | "rechazado") {
  return ejecutar("/admin/participantes", async (uid) => {
    const id = await getIdentidad();
    if (!id || !tieneRol(id, "admin", "comite")) throw new ErrorRegistro("Solo admin y comité pueden validar autorizaciones.");
    const [g, p] = await Promise.all([db().doc(`guardians/${participantId}`).get(), db().doc(`participants/${participantId}`).get()]);
    if (!g.exists) throw new ErrorRegistro("Esa persona no tiene autorización registrada.");
    const batch = db().batch();
    batch.update(g.ref, { estado: decision, validadoPor: uid, validadoAt: FieldValue.serverTimestamp() });
    auditarEn(batch, {
      actor: uid,
      accion: "guardian.decide",
      entidad: "guardians",
      entidadId: participantId,
      antes: { estado: g.get("estado") },
      despues: { estado: decision },
    });
    const evento = encolarEn(batch, "guardian.validated", { participantId, nombres: p.get("nombres"), email: p.get("email"), decision });
    await batch.commit();
    await despachar([evento]);
    return decision === "validado" ? "Autorización validada." : "Autorización rechazada: se avisará por correo.";
  });
}

/** Saca a una persona de la lista de espera si hay cupo. */
export async function admitirDeListaEspera(participantId: string) {
  return ejecutar("/admin/participantes", async (uid) => {
    await db().runTransaction(async (tx) => {
      const [p, stats] = await Promise.all([tx.get(db().doc(`participants/${participantId}`)), tx.get(db().doc("stats/inscripciones"))]);
      if (!p.get("enListaEspera")) throw new ErrorRegistro("Esa persona no está en lista de espera.");
      if ((stats.get("personas") ?? 0) >= EVENT.cupo.maxPersonas) throw new ErrorRegistro("El cupo sigue lleno.");
      tx.update(p.ref, { enListaEspera: false });
      tx.set(stats.ref, { personas: FieldValue.increment(1), listaEspera: FieldValue.increment(-1) }, { merge: true });
      auditarEn(tx, { actor: uid, accion: "waitlist.admit", entidad: "participants", entidadId: participantId });
    });
    return "Admitida: ahora aparece en matchmaking.";
  });
}

// ---------------------------------------------------------------------------
// Equipos
// ---------------------------------------------------------------------------

export async function crearEquipoAdmin(fd: FormData) {
  return ejecutar("/admin/equipos", async (uid) => {
    const r = z
      .object({ nombre: z.string().trim().min(3, "Escribe el nombre del equipo.").max(40), track: z.enum(["T1", "T2", "T3"], { error: "Elige el track." }) })
      .safeParse({ nombre: fd.get("nombre"), track: fd.get("track") });
    if (!r.success) throw new ErrorRegistro(r.error.issues[0]!.message);
    const slug = slugEquipo(r.data.nombre);
    const ref = db().doc(`teams/${slug}`);
    if ((await ref.get()).exists) throw new ErrorRegistro("Ya existe un equipo con ese nombre.");
    const batch = db().batch();
    batch.set(ref, {
      nombre: r.data.nombre,
      slug,
      track: r.data.track,
      categoria: "OPEN",
      conteoCategorias: { JUNIOR: 0, OPEN: 0 },
      codigoInvitacion: generarCodigo(),
      estado: "incompleto",
      miembros: 0,
      problemaCandidato: "",
      roomId: null,
      capitanId: null,
      requiereAdulto: false,
      adultoResponsableId: null,
      creadoPorOrganizacion: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(db().doc("stats/inscripciones"), { equipos: FieldValue.increment(1) }, { merge: true });
    auditarEn(batch, { actor: uid, accion: "team.create_admin", entidad: "teams", entidadId: slug, despues: r.data });
    await batch.commit();
    return `Equipo ${r.data.nombre} creado. Asígnale integrantes desde matchmaking.`;
  });
}

/** Matchmaking: asigna una persona sin equipo a un equipo (mismas reglas que unirse con código). */
export async function asignarAEquipo(participantId: string, fd: FormData) {
  return ejecutar("/admin/equipos", async (uid) => {
    const teamId = String(fd.get("teamId") ?? "");
    const team = await db().doc(`teams/${teamId}`).get();
    if (!team.exists) throw new ErrorRegistro("Elige un equipo.");
    const r = await unirseConCodigo(participantId, team.get("codigoInvitacion"));
    const batch = db().batch();
    auditarEn(batch, { actor: uid, accion: "matchmaking.assign", entidad: "teams", entidadId: teamId, despues: { participantId } });
    await batch.commit();
    return `Asignada al equipo ${r.teamNombre}.`;
  });
}

/** Fusiona el equipo origen en el destino (máximo 5 integrantes en total). */
export async function fusionarEquipos(fd: FormData) {
  return ejecutar("/admin/equipos", async (uid) => {
    const origen = String(fd.get("origen") ?? "");
    const destino = String(fd.get("destino") ?? "");
    if (!origen || !destino || origen === destino) throw new ErrorRegistro("Elige dos equipos distintos.");
    await db().runTransaction(async (tx) => {
      const [a, b] = await Promise.all([tx.get(db().doc(`teams/${origen}`)), tx.get(db().doc(`teams/${destino}`))]);
      if (!a.exists || !b.exists) throw new ErrorRegistro("Uno de los equipos ya no existe.");
      const miembros = await tx.get(db().collection("team_members").where("teamId", "==", origen));
      const total = (b.get("miembros") ?? 0) + miembros.size;
      if (total > EVENT.equipo.max) throw new ErrorRegistro(`La fusión deja ${total} integrantes: el máximo es ${EVENT.equipo.max}.`);
      const conteo: Record<Categoria, number> = {
        JUNIOR: (b.get("conteoCategorias.JUNIOR") ?? 0) + (a.get("conteoCategorias.JUNIOR") ?? 0),
        OPEN: (b.get("conteoCategorias.OPEN") ?? 0) + (a.get("conteoCategorias.OPEN") ?? 0),
      };
      for (const m of miembros.docs) {
        tx.set(db().doc(`team_members/${destino}_${m.get("participantId")}`), { ...m.data(), teamId: destino, esCapitan: false });
        tx.delete(m.ref);
        tx.update(db().doc(`participants/${m.get("participantId")}`), { teamId: destino });
      }
      tx.update(b.ref, {
        miembros: total,
        estado: estadoEquipo(total),
        conteoCategorias: conteo,
        categoria: categoriaEquipo([...Array<Categoria>(conteo.JUNIOR).fill("JUNIOR"), ...Array<Categoria>(conteo.OPEN).fill("OPEN")]),
        requiereAdulto: conteo.JUNIOR > 0,
      });
      tx.update(a.ref, { estado: "fusionado", miembros: 0, fusionadoEn: destino });
      tx.set(db().doc("stats/inscripciones"), { equipos: FieldValue.increment(-1) }, { merge: true });
      auditarEn(tx, { actor: uid, accion: "team.merge", entidad: "teams", entidadId: destino, despues: { origen, total } });
    });
    return "Equipos fusionados.";
  });
}

export async function cambiarTrackAdmin(teamId: string, fd: FormData) {
  return ejecutar("/admin/equipos", async (uid) => {
    const track = z.enum(["T1", "T2", "T3"]).safeParse(fd.get("track"));
    if (!track.success) throw new ErrorRegistro("Elige un track.");
    if (ahora() >= fecha("checkpoint1")) throw new ErrorRegistro("El track solo se puede cambiar hasta el checkpoint 1 (viernes 19:00).");
    const ref = db().doc(`teams/${teamId}`);
    const antes = (await ref.get()).get("track");
    const batch = db().batch();
    batch.update(ref, { track: track.data });
    auditarEn(batch, { actor: uid, accion: "team.track_admin", entidad: "teams", entidadId: teamId, antes: { track: antes }, despues: { track: track.data } });
    await batch.commit();
    return `Track cambiado a ${track.data}.`;
  });
}

export async function asignarAdulto(teamId: string, fd: FormData) {
  return ejecutar("/admin/equipos", async (uid) => {
    const adulto = String(fd.get("adulto") ?? "") || null;
    if (adulto && !(await db().doc(`staff/${adulto}`).get()).exists) throw new ErrorRegistro("Elige un adulto del staff.");
    const batch = db().batch();
    batch.update(db().doc(`teams/${teamId}`), { adultoResponsableId: adulto });
    auditarEn(batch, { actor: uid, accion: "team.adult", entidad: "teams", entidadId: teamId, despues: { adulto } });
    await batch.commit();
    return adulto ? "Adulto responsable asignado." : "Adulto responsable retirado.";
  });
}

// ---------------------------------------------------------------------------
// Repositorios
// ---------------------------------------------------------------------------

export async function revalidarRepo(teamId: string) {
  return ejecutar("/admin/repositorios", async () => {
    const s = await tomarSnapshot(teamId);
    if (!s) throw new ErrorRegistro("El equipo no tiene repositorio registrado.");
    return `Revalidado: ${s.commitsEnVentana} commits, ${s.alertas.length} alertas.`;
  });
}

/** A4 (corresponde al track inscrito) lo decide la mesa técnica. */
export async function decidirA4(teamId: string, fd: FormData) {
  return ejecutar("/admin/repositorios", async (uid) => {
    const valor = fd.get("a4");
    const a4 = valor === "si" ? true : valor === "no" ? false : null;
    const batch = db().batch();
    batch.set(db().doc(`admissibility/${teamId}`), { teamId, a4, revisadoPor: uid, revisadoAt: FieldValue.serverTimestamp() }, { merge: true });
    auditarEn(batch, { actor: uid, accion: "admissibility.a4", entidad: "admissibility", entidadId: teamId, despues: { a4 } });
    await batch.commit();
    return a4 === null ? "A4 queda pendiente." : a4 ? "A4: corresponde al track." : "A4: no corresponde al track.";
  });
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

/** Viernes hasta las 00:00 del sábado (hora de Ecuador); después, sábado. */
function diaDelEvento(): "viernes" | "sabado" {
  const sabado = new Date(`${EVENT.fechas.codeFreeze.iso.slice(0, 10)}T00:00:00-05:00`);
  return ahora() < sabado ? "viernes" : "sabado";
}

/** Registra el check-in por QR (token firmado) o por búsqueda manual (participantId). */
export async function registrarCheckin(entrada: { token?: string; participantId?: string }) {
  return ejecutar("/admin/checkin", async (uid) => {
    let pid = entrada.participantId ?? null;
    if (entrada.token) {
      pid = verificarTokenQr(process.env.CHECKIN_QR_SECRET ?? "", entrada.token);
      if (!pid) throw new ErrorRegistro("QR no válido: pide a la persona que abra su QR desde Mi equipo.");
    }
    if (!pid) throw new ErrorRegistro("Indica a quién registrar.");
    const dia = diaDelEvento();
    const ref = db().doc(`checkins/${pid}_${dia}`);
    let nombre = "";
    const eventos: Evento[] = [];
    await db().runTransaction(async (tx) => {
      eventos.length = 0;
      const [p, previo] = await Promise.all([tx.get(db().doc(`participants/${pid}`)), tx.get(ref)]);
      if (!p.exists) throw new ErrorRegistro("No encontramos a esa persona entre los inscritos.");
      nombre = `${p.get("nombres")} ${p.get("apellidos")}`;
      if (previo.exists) throw new ErrorRegistro(`${nombre} ya hizo check-in hoy.`);
      tx.set(ref, {
        participantId: pid,
        teamId: p.get("teamId") ?? null,
        dia,
        timestamp: FieldValue.serverTimestamp(),
        staffId: uid,
        metodo: entrada.token ? "qr" : "manual",
      });
      auditarEn(tx, { actor: uid, accion: "checkin.create", entidad: "checkins", entidadId: ref.id });
      eventos.push(encolarEn(tx, "checkin.created", { participantId: pid, teamId: p.get("teamId") ?? null, dia, categoria: p.get("categoria") }));
    });
    await despachar(eventos);
    return `Check-in registrado: ${nombre}.`;
  });
}

// ---------------------------------------------------------------------------
// Comunicados
// ---------------------------------------------------------------------------

export async function enviarComunicado(fd: FormData) {
  return ejecutar("/admin/comunicados", async (uid) => {
    const r = z
      .object({
        tipo: z.enum(["todos", "track", "equipo"], { error: "Elige el alcance." }),
        track: z.string().optional(),
        teamId: z.string().optional(),
        mensaje: z.string().trim().min(10, "Escribe el comunicado (mínimo 10 caracteres).").max(1000),
      })
      .safeParse({ tipo: fd.get("tipo"), track: fd.get("track") || undefined, teamId: fd.get("teamId") || undefined, mensaje: fd.get("mensaje") });
    if (!r.success) throw new ErrorRegistro(r.error.issues[0]!.message);
    if ((r.data.tipo === "track" && !r.data.track) || (r.data.tipo === "equipo" && !r.data.teamId)) throw new ErrorRegistro("Completa el alcance del comunicado.");
    const alcance =
      r.data.tipo === "todos" ? { tipo: "todos" } : r.data.tipo === "track" ? { tipo: "track", track: r.data.track } : { tipo: "equipo", teamId: r.data.teamId };
    // Destinatarios: equipo, track o todos los inscritos (no en lista de espera).
    let personas = (await db().collection("participants").where("enListaEspera", "==", false).get()).docs;
    if (r.data.tipo === "equipo") personas = personas.filter((p) => p.get("teamId") === r.data.teamId);
    if (r.data.tipo === "track") {
      const equipos = new Set((await db().collection("teams").where("track", "==", r.data.track).get()).docs.map((t) => t.id));
      personas = personas.filter((p) => equipos.has(p.get("teamId")));
    }
    const ref = db().collection("announcements").doc();
    const batch = db().batch();
    batch.set(ref, { alcance, mensaje: r.data.mensaje, autorId: uid, destinatarios: personas.length, enviadoAt: FieldValue.serverTimestamp() });
    auditarEn(batch, { actor: uid, accion: "announcement.create", entidad: "announcements", entidadId: ref.id, despues: { alcance, destinatarios: personas.length } });
    const evento = encolarEn(batch, "announcement.created", {
      id: ref.id,
      alcance,
      mensaje: r.data.mensaje,
      destinatarios: personas.map((p) => p.get("email") as string).filter(Boolean),
    });
    await batch.commit();
    await despachar([evento]);
    return `Comunicado enviado a ${personas.length} personas (por correo y Slack vía n8n).`;
  });
}

// ---------------------------------------------------------------------------
// Mentoría
// ---------------------------------------------------------------------------

export async function cambiarEstadoMentoria(requestId: string, estado: "atendida" | "cerrada") {
  return ejecutar(
    "/admin/mentoria",
    async (uid) => {
      const ref = db().doc(`mentor_requests/${requestId}`);
      if (!(await ref.get()).exists) throw new ErrorRegistro("La solicitud ya no existe.");
      const batch = db().batch();
      batch.update(ref, estado === "atendida" ? { estado, mentorId: uid, atendidaAt: FieldValue.serverTimestamp() } : { estado, cerradaAt: FieldValue.serverTimestamp() });
      auditarEn(batch, { actor: uid, accion: `mentor.${estado}`, entidad: "mentor_requests", entidadId: requestId });
      await batch.commit();
      return estado === "atendida" ? "Solicitud tomada: ve con el equipo." : "Solicitud cerrada.";
    },
    ["/admin/mentoria", "/admin"],
  );
}

/** El equipo pide mentoría por tema (Guía del Hacker §9). Una solicitud abierta por tema. */
export async function pedirMentoria(fd: FormData): Promise<ResultadoAccion> {
  try {
    const id = await getIdentidad();
    if (!id?.esParticipante) throw new ErrorRegistro("Tu sesión expiró. Vuelve a ingresar.");
    const p = await db().doc(`participants/${id.uid}`).get();
    const teamId = p.get("teamId") as string | null;
    if (!teamId) throw new ErrorRegistro("Necesitas un equipo para pedir mentoría.");
    const tema = z.enum(MENTORIA_TEMAS).safeParse(fd.get("tema"));
    if (!tema.success) throw new ErrorRegistro("Elige el tema de la mentoría.");
    const detalle = String(fd.get("detalle") ?? "")
      .trim()
      .slice(0, 300);
    const ref = db().doc(`mentor_requests/${teamId}_${tema.data}_${Date.now()}`);
    const team = await db().doc(`teams/${teamId}`).get();
    const eventos: Evento[] = [];
    await db().runTransaction(async (tx) => {
      eventos.length = 0;
      const abiertas = await tx.get(
        db().collection("mentor_requests").where("teamId", "==", teamId).where("tema", "==", tema.data).where("estado", "==", "abierta"),
      );
      if (!abiertas.empty) throw new ErrorRegistro("Ya tienen una solicitud abierta de ese tema: un mentor va en camino.");
      tx.set(ref, { teamId, tema: tema.data, detalle, estado: "abierta", mentorId: null, solicitadaPor: id.uid, abiertaAt: FieldValue.serverTimestamp(), atendidaAt: null });
      auditarEn(tx, { actor: id.uid, accion: "mentor.request", entidad: "mentor_requests", entidadId: ref.id });
      eventos.push(encolarEn(tx, "mentor.requested", { requestId: ref.id, teamId, teamNombre: team.get("nombre"), tema: tema.data, detalle }));
    });
    await despachar(eventos);
    revalidatePath("/mi-equipo/mentoria");
    return { ok: true, mensaje: "Solicitud enviada: avisamos al mentor disponible del tema." };
  } catch (err) {
    if (err instanceof ErrorRegistro) return { ok: false, error: err.message };
    return { ok: false, error: "No pudimos enviar la solicitud. Inténtalo de nuevo." };
  }
}

// ---------------------------------------------------------------------------------------------
// Privacidad (LOPDP): solicitudes de eliminación y política de retención (D-43). Solo admin.
// ---------------------------------------------------------------------------------------------

export async function anonimizarSolicitud(participantId: string): Promise<ResultadoAccion> {
  return ejecutar("/admin/privacidad", async (uid) => {
    const r = await anonimizarParticipante(participantId, { actor: uid, motivo: "solicitud", ahora: ahora() });
    return r.salioDeEquipo ? "Datos anonimizados. La persona salió de su equipo y se liberó su cupo." : "Datos anonimizados.";
  });
}

export async function aplicarPoliticaRetencion(): Promise<ResultadoAccion> {
  return ejecutar("/admin/privacidad", async (uid) => {
    if (ahora() < fechaRetencion()) throw new ErrorRegistro("La política de retención todavía no vence.");
    const r = await aplicarRetencion({ actor: uid, ahora: ahora() });
    return `${r.anonimizados} personas anonimizadas; ${Object.values(r.borrados).reduce((a, b) => a + b, 0)} registros operativos borrados.`;
  });
}
