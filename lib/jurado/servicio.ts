import "server-only";
import { randomInt } from "node:crypto";
import { FieldValue, type DocumentSnapshot } from "firebase-admin/firestore";
import { z } from "zod";
import { EVENT, TRACK_CODES, fecha, type TrackCode } from "@/config/event";
import { auditarEn } from "@/lib/audit";
import { despachar, encolarEn } from "@/lib/eventos";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ErrorRegistro } from "@/lib/registro/servicio";
import {
  calcularPremios,
  puntajeEquipo,
  rankingFinal,
  roomNormalization,
  scoreTotal,
  seleccionarFinalistas,
  type PuntajeJuez,
  type ResultadoEquipo,
} from "@/lib/scoring";

/**
 * Jurado y resultados (prompt §4, rúbrica §4–§8). Toda escritura pasa por aquí, con auditoría.
 * Rondas: "semifinal" (salas por track) y "final" (sala "final", top 5, jurado con final=true).
 */

export type Ronda = "semifinal" | "final";
export const SALA_FINAL = "final";
const db = () => adminDb();
const eventoRef = () => db().doc(`events/${EVENT.id}`);
export const MINUTOS_POR_SLOT = EVENT.showAndTell.minutosExposicion + EVENT.showAndTell.minutosPreguntas + EVENT.showAndTell.minutosTransicion;

export async function rondaActiva(): Promise<Ronda> {
  return ((await eventoRef().get()).get("rondaActiva") as Ronda | undefined) ?? "semifinal";
}

// ---------------------------------------------------------------------------
// Salas y jueces
// ---------------------------------------------------------------------------

export const salaSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,30}$/, "El identificador usa minúsculas, números y guiones (p. ej. sala-1)."),
  nombre: z.string().trim().min(2, "Escribe el nombre de la sala.").max(60),
  tracks: z.array(z.enum(["T1", "T2", "T3"])).min(1, "Elige al menos un track para la sala."),
});

export async function guardarSala(datos: z.infer<typeof salaSchema>, actor: string) {
  if (datos.id === SALA_FINAL) throw new ErrorRegistro("El identificador «final» está reservado para la plenaria.");
  const batch = db().batch();
  batch.set(db().doc(`rooms/${datos.id}`), { nombre: datos.nombre, tracks: datos.tracks, cerrada: false }, { merge: true });
  auditarEn(batch, { actor, accion: "room.save", entidad: "rooms", entidadId: datos.id, despues: datos });
  await batch.commit();
}

export const juezSchema = z.object({
  email: z.email("Escribe el correo del juez."),
  nombre: z.string().trim().min(3, "Escribe el nombre del juez.").max(80),
  perfil: z.enum(["tecnico", "educativo", "negocio"], { error: "Elige el perfil del juez." }),
  roomId: z.string().trim().min(1, "Asigna una sala de semifinal."),
  final: z.boolean().default(false),
});

/** Alta o actualización de un juez: crea su cuenta de acceso (enlace mágico) si no existe. */
export async function guardarJuez(datos: z.infer<typeof juezSchema>, actor: string) {
  const email = datos.email.toLowerCase();
  let uid: string;
  try {
    uid = (await adminAuth().getUserByEmail(email)).uid;
  } catch {
    uid = (await adminAuth().createUser({ email, displayName: datos.nombre })).uid;
  }
  const sala = await db().doc(`rooms/${datos.roomId}`).get();
  if (!sala.exists) throw new ErrorRegistro("La sala elegida no existe.");
  const batch = db().batch();
  batch.set(db().doc(`judges/${uid}`), { nombre: datos.nombre, perfil: datos.perfil, roomId: datos.roomId, final: datos.final }, { merge: true });
  auditarEn(batch, {
    actor,
    accion: "judge.save",
    entidad: "judges",
    entidadId: uid,
    despues: { perfil: datos.perfil, roomId: datos.roomId, final: datos.final },
  });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Orden de presentación
// ---------------------------------------------------------------------------

function horaSlot(inicio: Date, indice: number): Date {
  return new Date(inicio.getTime() + indice * MINUTOS_POR_SLOT * 60_000);
}

function barajar<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function datosSlot(roomId: string, e: DocumentSnapshot, ronda: Ronda, i: number, inicio: Date) {
  return {
    roomId,
    teamId: e.id,
    equipo: e.get("nombre"),
    track: e.get("track"),
    ronda,
    orden: i + 1,
    horaProgramada: horaSlot(inicio, i),
    inicioReal: null,
    finReal: null,
  };
}

/**
 * Genera el orden de presentación. Semifinal: equipos completos repartidos en las salas que
 * aceptan su track, en orden aleatorio, cada 15 min desde las 13:30. Final: los finalistas en la
 * sala "final" desde las 17:00. Reemplaza el orden previo de esa ronda.
 */
export async function generarOrden(ronda: Ronda, actor: string): Promise<number> {
  const previos = await db().collection("presentation_slots").where("ronda", "==", ronda).get();
  const batch = db().batch();
  previos.docs.forEach((d) => batch.delete(d.ref));
  let total = 0;

  if (ronda === "semifinal") {
    const [salas, equipos] = await Promise.all([db().collection("rooms").get(), db().collection("teams").where("estado", "==", "completo").get()]);
    const salasSemi = salas.docs.filter((s) => s.id !== SALA_FINAL);
    if (!salasSemi.length) throw new ErrorRegistro("Primero crea las salas de semifinal.");
    const porSala = new Map<string, DocumentSnapshot[]>(salasSemi.map((s) => [s.id, []]));
    for (const t of TRACK_CODES) {
      const destino = salasSemi.filter((s) => (s.get("tracks") as TrackCode[]).includes(t));
      if (!destino.length) continue;
      barajar(equipos.docs.filter((e) => e.get("track") === t)).forEach((e, i) => porSala.get(destino[i % destino.length]!.id)!.push(e));
    }
    for (const [roomId, lista] of porSala) {
      barajar(lista).forEach((e, i) => {
        batch.set(db().doc(`presentation_slots/${ronda}_${roomId}_${e.id}`), datosSlot(roomId, e, ronda, i, fecha("showAndTell")));
        batch.update(e.ref, { roomId }); // denormalizado para las reglas del jurado
        total++;
      });
    }
  } else {
    const finalistas = await db().collection("teams").where("finalista", "==", true).get();
    if (finalistas.empty) throw new ErrorRegistro("Primero confirma los finalistas en Resultados.");
    batch.set(db().doc(`rooms/${SALA_FINAL}`), { nombre: "Final (plenaria)", tracks: [...TRACK_CODES], cerrada: false }, { merge: true });
    barajar(finalistas.docs).forEach((e, i) => {
      batch.set(db().doc(`presentation_slots/${ronda}_${SALA_FINAL}_${e.id}`), datosSlot(SALA_FINAL, e, ronda, i, fecha("final")));
      total++;
    });
  }
  auditarEn(batch, { actor, accion: "slots.generate", entidad: "presentation_slots", entidadId: ronda, despues: { total } });
  await batch.commit();
  return total;
}

/** Sube o baja un equipo en el orden de su sala y recalcula las horas programadas. */
export async function moverSlot(slotId: string, direccion: -1 | 1, actor: string) {
  const slot = await db().doc(`presentation_slots/${slotId}`).get();
  if (!slot.exists) throw new ErrorRegistro("Ese turno ya no existe.");
  const hermanos = (
    await db().collection("presentation_slots").where("ronda", "==", slot.get("ronda")).where("roomId", "==", slot.get("roomId")).get()
  ).docs.sort((a, b) => a.get("orden") - b.get("orden"));
  const i = hermanos.findIndex((h) => h.id === slotId);
  const j = i + direccion;
  if (j < 0 || j >= hermanos.length) return;
  [hermanos[i], hermanos[j]] = [hermanos[j]!, hermanos[i]!];
  const inicio = slot.get("ronda") === "final" ? fecha("final") : fecha("showAndTell");
  const batch = db().batch();
  hermanos.forEach((h, k) => batch.update(h.ref, { orden: k + 1, horaProgramada: horaSlot(inicio, k) }));
  auditarEn(batch, { actor, accion: "slots.move", entidad: "presentation_slots", entidadId: slotId, despues: { direccion } });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Evaluación
// ---------------------------------------------------------------------------

const nivel = z.coerce
  .number({ error: "Elige un nivel del 1 al 5." })
  .int()
  .min(1, "Elige un nivel del 1 al 5.")
  .max(5, "Elige un nivel del 1 al 5.");

export const puntajeSchema = z.object({
  c1: nivel,
  c2: nivel,
  c3: nivel,
  c4: nivel,
  c5: nivel,
  c6: nivel,
  tiempoUsadoSeg: z.coerce.number({ error: "Registra el tiempo usado." }).int().min(0).max(30 * 60, "El tiempo usado no puede superar 30 minutos."),
  demoEnVivo: z.boolean({ error: "Indica si la demo fue en vivo o con respaldo autorizado." }),
  fortaleza: z.string().trim().min(10, "Escribe al menos una fortaleza (mínimo 10 caracteres): se envía al equipo.").max(600),
  recomendacion: z.string().trim().min(10, "Escribe al menos una recomendación (mínimo 10 caracteres): se envía al equipo.").max(600),
});

export interface ContextoEvaluacion {
  ronda: Ronda;
  roomId: string;
  salaCerrada: boolean;
  team: DocumentSnapshot;
  conflicto: { motivo: string } | null;
  puntaje: DocumentSnapshot | null;
}

/** Verifica que el juez pueda evaluar al equipo en la ronda activa (mismas reglas que firestore.rules). */
export async function contextoEvaluacion(judgeUid: string, teamId: string): Promise<ContextoEvaluacion> {
  const [juez, team, ronda] = await Promise.all([db().doc(`judges/${judgeUid}`).get(), db().doc(`teams/${teamId}`).get(), rondaActiva()]);
  if (!juez.exists) throw new ErrorRegistro("Tu cuenta no está registrada como jurado.");
  if (!team.exists) throw new ErrorRegistro("Ese equipo no existe.");
  let roomId: string;
  if (ronda === "final") {
    if (!juez.get("final") || !team.get("finalista")) throw new ErrorRegistro("Este equipo no está en la final o no formas parte del jurado de la final.");
    roomId = SALA_FINAL;
  } else {
    if (!juez.get("roomId") || team.get("roomId") !== juez.get("roomId")) throw new ErrorRegistro("Este equipo no presenta en tu sala.");
    roomId = juez.get("roomId");
  }
  const [sala, conflicto, puntaje] = await Promise.all([
    db().doc(`rooms/${roomId}`).get(),
    db().doc(`conflicts/${judgeUid}_${teamId}`).get(),
    db().doc(`scores/${ronda}_${judgeUid}_${teamId}`).get(),
  ]);
  return {
    ronda,
    roomId,
    salaCerrada: sala.get("cerrada") === true,
    team,
    conflicto: conflicto.exists ? { motivo: conflicto.get("motivo") } : null,
    puntaje: puntaje.exists ? puntaje : null,
  };
}

/** Guarda (o corrige mientras la sala esté abierta) el puntaje de un juez. Devuelve el total. */
export async function guardarPuntaje(judgeUid: string, teamId: string, datos: z.infer<typeof puntajeSchema>): Promise<number> {
  const ctx = await contextoEvaluacion(judgeUid, teamId);
  if (ctx.salaCerrada) throw new ErrorRegistro("La sala ya cerró: los puntajes están bloqueados. Solo el comité puede reabrirla.");
  if (ctx.conflicto) throw new ErrorRegistro("Declaraste conflicto de interés con este equipo: no puedes evaluarlo.");
  const total = scoreTotal(datos);
  const ref = db().doc(`scores/${ctx.ronda}_${judgeUid}_${teamId}`);
  const batch = db().batch();
  batch.set(ref, {
    judgeId: judgeUid,
    teamId,
    roomId: ctx.roomId,
    ronda: ctx.ronda,
    ...datos,
    total,
    enviadoAt: FieldValue.serverTimestamp(),
    bloqueado: false,
  });
  auditarEn(batch, {
    actor: judgeUid,
    accion: ctx.puntaje ? "score.update" : "score.submit",
    entidad: "scores",
    entidadId: ref.id,
    antes: ctx.puntaje ? { total: ctx.puntaje.get("total") } : null,
    despues: { total },
  });
  await batch.commit();
  return total;
}

/** Declaración de conflicto de interés: el juez no evalúa al equipo (rúbrica §8). */
export async function declararConflicto(judgeUid: string, teamId: string, motivo: string) {
  const m = motivo.trim();
  if (m.length < 5) throw new ErrorRegistro("Describe brevemente el conflicto (mínimo 5 caracteres).");
  const ctx = await contextoEvaluacion(judgeUid, teamId);
  if (ctx.puntaje) throw new ErrorRegistro("Ya registraste un puntaje para este equipo: pide al comité que lo anule antes de declarar el conflicto.");
  const batch = db().batch();
  batch.set(db().doc(`conflicts/${judgeUid}_${teamId}`), { judgeId: judgeUid, teamId, motivo: m, ronda: ctx.ronda, declaradoAt: FieldValue.serverTimestamp() });
  auditarEn(batch, { actor: judgeUid, accion: "conflict.declare", entidad: "conflicts", entidadId: `${judgeUid}_${teamId}` });
  await batch.commit();
}

/** Cerrar la sala bloquea todos sus puntajes de la ronda; reabrirla requiere al comité (y queda auditado). */
export async function cambiarEstadoSala(roomId: string, cerrar: boolean, actor: string, motivo = "") {
  if (!cerrar && motivo.trim().length < 5) throw new ErrorRegistro("Para reabrir una sala indica el motivo (queda en la auditoría).");
  const ronda = roomId === SALA_FINAL ? "final" : "semifinal";
  const puntajes = await db().collection("scores").where("ronda", "==", ronda).where("roomId", "==", roomId).get();
  const batch = db().batch();
  batch.update(db().doc(`rooms/${roomId}`), { cerrada: cerrar, [cerrar ? "cerradaAt" : "reabiertaAt"]: FieldValue.serverTimestamp() });
  puntajes.docs.forEach((d) => batch.update(d.ref, { bloqueado: cerrar }));
  auditarEn(batch, {
    actor,
    accion: cerrar ? "room.close" : "room.reopen",
    entidad: "rooms",
    entidadId: roomId,
    despues: { puntajes: puntajes.size, motivo: motivo || null },
  });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Cronómetro y avisos de /pantalla
// ---------------------------------------------------------------------------

export type AccionCronometro = "iniciar" | "pausar" | "reiniciar" | "terminar";

/** Elige el equipo que presenta en una sala y deja el cronómetro en cero. */
export async function prepararTurno(slotId: string, actor: string) {
  const slot = await db().doc(`presentation_slots/${slotId}`).get();
  if (!slot.exists) throw new ErrorRegistro("Ese turno ya no existe.");
  const sala = await db().doc(`rooms/${slot.get("roomId")}`).get();
  await db()
    .doc(`public_state/cronometro_${slot.get("roomId")}`)
    .set({
      roomId: slot.get("roomId"),
      sala: sala.get("nombre") ?? slot.get("roomId"),
      slotId,
      equipo: slot.get("equipo"),
      orden: slot.get("orden"),
      corriendo: false,
      inicioMs: null,
      acumuladoMs: 0,
      actualizadoPor: actor,
      actualizadoAt: FieldValue.serverTimestamp(),
    });
}

export async function controlarCronometro(roomId: string, accion: AccionCronometro, actor: string, ahoraMs = Date.now()) {
  const ref = db().doc(`public_state/cronometro_${roomId}`);
  const c = await ref.get();
  if (!c.exists || !c.get("slotId")) throw new ErrorRegistro("Primero elige el equipo que presenta.");
  const acumulado: number = c.get("acumuladoMs") ?? 0;
  const inicio: number | null = c.get("inicioMs") ?? null;
  const slotRef = db().doc(`presentation_slots/${c.get("slotId")}`);
  const batch = db().batch();
  if (accion === "iniciar" && !c.get("corriendo")) {
    batch.update(ref, { corriendo: true, inicioMs: ahoraMs });
    if (acumulado === 0) batch.update(slotRef, { inicioReal: new Date(ahoraMs) });
  } else if (accion === "pausar" && c.get("corriendo") && inicio) {
    batch.update(ref, { corriendo: false, inicioMs: null, acumuladoMs: acumulado + (ahoraMs - inicio) });
  } else if (accion === "reiniciar") {
    batch.update(ref, { corriendo: false, inicioMs: null, acumuladoMs: 0 });
  } else if (accion === "terminar") {
    const total = acumulado + (c.get("corriendo") && inicio ? ahoraMs - inicio : 0);
    batch.update(ref, { corriendo: false, inicioMs: null, acumuladoMs: total });
    batch.update(slotRef, { finReal: new Date(ahoraMs), duracionSeg: Math.round(total / 1000) });
  }
  batch.update(ref, { actualizadoPor: actor, actualizadoAt: FieldValue.serverTimestamp() });
  await batch.commit();
}

export async function publicarAviso(texto: string, actor: string) {
  const aviso = texto.trim().slice(0, 200) || null;
  await db().doc("public_state/pantalla").set({ aviso, actualizadoPor: actor, actualizadoAt: FieldValue.serverTimestamp() }, { merge: true });
}

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

export interface DatosRonda {
  resultados: ResultadoEquipo[];
  progreso: { roomId: string; esperadas: number; registradas: number; conflictos: number; cerrada: boolean }[];
  nombres: Record<string, string>;
  tracks: Record<string, TrackCode>;
}

/** Junta puntajes, conflictos y equipos de una ronda en la forma que usa lib/scoring.ts. */
export async function cargarRonda(ronda: Ronda): Promise<DatosRonda> {
  const [puntajes, conflictos, slots, jueces, salas, equipos] = await Promise.all([
    db().collection("scores").where("ronda", "==", ronda).get(),
    db().collection("conflicts").get(),
    db().collection("presentation_slots").where("ronda", "==", ronda).get(),
    db().collection("judges").get(),
    db().collection("rooms").get(),
    db().collection("teams").get(),
  ]);
  const nombres = Object.fromEntries(equipos.docs.map((e) => [e.id, e.get("nombre") as string]));
  const tracks = Object.fromEntries(equipos.docs.map((e) => [e.id, e.get("track") as TrackCode]));
  const conjuntoConflictos = new Set(conflictos.docs.map((c) => c.id));
  const lista: PuntajeJuez[] = puntajes.docs.map((d) => ({
    judgeId: d.get("judgeId"),
    teamId: d.get("teamId"),
    c1: d.get("c1"),
    c2: d.get("c2"),
    c3: d.get("c3"),
    c4: d.get("c4"),
    c5: d.get("c5"),
    c6: d.get("c6"),
    tiempoUsadoSeg: d.get("tiempoUsadoSeg") ?? 0,
  }));
  const resultados = slots.docs.map((s) => puntajeEquipo(s.get("teamId"), s.get("roomId"), lista, conjuntoConflictos)).filter((r) => r.jueces > 0);
  const progreso = salas.docs
    .filter((s) => (ronda === "final" ? s.id === SALA_FINAL : s.id !== SALA_FINAL))
    .map((s) => {
      const juecesSala = jueces.docs.filter((j) => (ronda === "final" ? j.get("final") === true : j.get("roomId") === s.id));
      const slotsSala = slots.docs.filter((x) => x.get("roomId") === s.id);
      const conflictosSala = slotsSala.reduce((n, x) => n + juecesSala.filter((j) => conjuntoConflictos.has(`${j.id}_${x.get("teamId")}`)).length, 0);
      return {
        roomId: s.id,
        esperadas: juecesSala.length * slotsSala.length - conflictosSala,
        registradas: puntajes.docs.filter((p) => p.get("roomId") === s.id).length,
        conflictos: conflictosSala,
        cerrada: s.get("cerrada") === true,
      };
    });
  return { resultados, progreso, nombres, tracks };
}

export async function propuestaSemifinal() {
  const datos = await cargarRonda("semifinal");
  const normalizacion = roomNormalization(datos.resultados);
  return { ...datos, ...normalizacion, propuesta: seleccionarFinalistas(normalizacion.equipos, EVENT.showAndTell.finalistas) };
}

/** El comité confirma los finalistas: se marcan, se abre la ronda final y se genera su orden. */
export async function confirmarFinalistas(teamIds: string[], actor: string) {
  if (teamIds.length < 1 || teamIds.length > EVENT.showAndTell.finalistas) {
    throw new ErrorRegistro(`Elige entre 1 y ${EVENT.showAndTell.finalistas} finalistas.`);
  }
  const equipos = await db().collection("teams").get();
  const batch = db().batch();
  equipos.docs.forEach((e) => batch.update(e.ref, { finalista: teamIds.includes(e.id) }));
  batch.set(eventoRef(), { rondaActiva: "final" }, { merge: true });
  auditarEn(batch, { actor, accion: "finalists.confirm", entidad: "teams", entidadId: "final", despues: { teamIds } });
  await batch.commit();
  await generarOrden("final", actor);
}

/**
 * Publica los resultados: ranking final (con el orden manual del comité para empates sin
 * resolver), premios, resultado por equipo con fortalezas y recomendaciones (sin identificar al
 * juez) y el evento results.published para los certificados (WF-09).
 */
export async function publicarResultados(ordenFinal: string[], aceleradora: string[], actor: string) {
  const [semi, fin, equipos, repos] = await Promise.all([
    propuestaSemifinal(),
    cargarRonda("final"),
    db().collection("teams").get(),
    db().collection("repositories").get(),
  ]);
  const ranking = rankingFinal(fin.resultados);
  const finalistas = new Set(fin.resultados.map((r) => r.teamId));
  if (ordenFinal.length !== finalistas.size || !ordenFinal.every((t) => finalistas.has(t)) || new Set(ordenFinal).size !== ordenFinal.length) {
    throw new ErrorRegistro("El orden final debe incluir a todos los finalistas evaluados, una sola vez.");
  }
  if (aceleradora.length > 3) throw new ErrorRegistro("La Aceleradora admite hasta 3 equipos.");
  const conN8n = Object.fromEntries(repos.docs.map((r) => [r.id, (r.get("ultimoSnapshot")?.archivosObligatorios?.["n8n/*.json"] ?? false) === true]));
  const junior = Object.fromEntries(equipos.docs.map((e) => [e.id, e.get("categoria") === "JUNIOR"]));
  const { premios } = calcularPremios({ ordenFinal, semifinal: semi.resultados, track: semi.tracks, tieneN8n: conN8n, esJunior: junior });
  const todosPremios = [...premios, ...aceleradora.map((teamId) => ({ premio: "Pase a la Aceleradora Eight Academy", teamId }))];

  const puntajes = await db().collection("scores").get();
  const batch = db().batch();
  for (const e of equipos.docs) {
    const s = semi.equipos.find((x) => x.teamId === e.id);
    if (!s) continue; // no presentó
    const textos = puntajes.docs.filter((p) => p.get("teamId") === e.id);
    batch.set(db().doc(`results/${e.id}`), {
      teamId: e.id,
      publicado: true,
      puntajeSemifinal: s.puntaje,
      z: s.z,
      sinNormalizar: s.sinNormalizar,
      finalista: finalistas.has(e.id),
      puntajeFinal: fin.resultados.find((r) => r.teamId === e.id)?.puntaje ?? null,
      posicionFinal: finalistas.has(e.id) ? ordenFinal.indexOf(e.id) + 1 : null,
      premios: todosPremios.filter((p) => p.teamId === e.id).map((p) => p.premio),
      fortalezas: textos.map((t) => t.get("fortaleza") as string),
      recomendaciones: textos.map((t) => t.get("recomendacion") as string),
      publicadoAt: FieldValue.serverTimestamp(),
    });
  }
  batch.set(db().doc("public_state/resultados"), {
    publicado: true,
    ranking: ordenFinal.map((t, i) => ({ posicion: i + 1, equipo: fin.nombres[t] ?? t, track: fin.tracks[t] ?? null })),
    premios: todosPremios.filter((p) => p.teamId).map((p) => ({ premio: p.premio, equipo: semi.nombres[p.teamId!] ?? p.teamId })),
    publicadoAt: FieldValue.serverTimestamp(),
  });
  batch.set(eventoRef(), { resultadosPublicados: true, resultadosPublicadosAt: FieldValue.serverTimestamp() }, { merge: true });
  auditarEn(batch, {
    actor,
    accion: "results.publish",
    entidad: "events",
    entidadId: EVENT.id,
    // Firestore no admite arrays anidados: los empates se guardan como "a = b".
    despues: { ordenFinal, empatesSinResolver: ranking.empatesSinResolver.map(([a, b]) => `${a} = ${b}`), aceleradora },
  });

  // Integrantes por equipo para certificados (participación, finalista, ganador).
  const miembros = await db().collection("team_members").get();
  const participantes = miembros.empty ? [] : await db().getAll(...miembros.docs.map((m) => db().doc(`participants/${m.get("participantId")}`)));
  const correo = new Map(participantes.map((p) => [p.id, p.get("email") as string]));
  const evento = encolarEn(batch, "results.published", {
    equipos: equipos.docs
      .filter((e) => semi.equipos.some((s) => s.teamId === e.id))
      .map((e) => ({
        teamId: e.id,
        nombre: e.get("nombre"),
        finalista: finalistas.has(e.id),
        posicionFinal: finalistas.has(e.id) ? ordenFinal.indexOf(e.id) + 1 : null,
        premios: todosPremios.filter((p) => p.teamId === e.id).map((p) => p.premio),
        integrantes: miembros.docs
          .filter((m) => m.get("teamId") === e.id)
          .map((m) => ({ nombre: m.get("nombre"), email: correo.get(m.get("participantId")) ?? null })),
      })),
  });
  await batch.commit();
  await despachar([evento]);
}
