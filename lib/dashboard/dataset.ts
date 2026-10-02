import type { Firestore, QueryDocumentSnapshot, QuerySnapshot, Timestamp } from "firebase-admin/firestore";
import { EVENT, fecha } from "@/config/event";
import { semaforo, type Dataset, type Fila } from "@/lib/dashboard/kpis";
import { horaEcuador } from "@/lib/github";
import { scoreTotal, type Niveles } from "@/lib/scoring";

/**
 * Dataset plano del dashboard (equivale a la vista SQL v_dashboard_dataset del prompt; D-36).
 * Una fila por entidad, columnas snake_case, fechas ISO y booleanos 0/1: listo para Power BI,
 * Looker Studio, Excel o SQL. Recibe el Firestore por parámetro para poder usarse también desde
 * scripts (scripts/verificar-kpis.ts), fuera de Next.
 *
 * Los datos de contacto (nombres, correo, celular) solo se incluyen si `conContacto` (rol admin).
 * Los puntajes solo si `conPuntajes` (admin y comité).
 */

const fechaDe = (t: unknown): Date | null => {
  if (t instanceof Date) return t;
  return t && typeof (t as Timestamp).toDate === "function" ? (t as Timestamp).toDate() : null;
};
const iso = (t: unknown) => fechaDe(t)?.toISOString() ?? null;
const b = (x: unknown) => (x ? 1 : 0);
/** Día civil en Ecuador (UTC-5). */
const diaEcuador = (d: Date) => new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 10);
const COLECCIONES = [
  "participants",
  "teams",
  "guardians",
  "checkins",
  "repositories",
  "repo_snapshots",
  "submissions",
  "admissibility",
  "mentor_requests",
  "scores",
  "presentation_slots",
  "judges",
  "conflicts",
] as const;

export async function construirDataset(db: Firestore, opts: { ahora: Date; conContacto: boolean; conPuntajes: boolean }): Promise<Dataset> {
  const snaps = await Promise.all(COLECCIONES.map((c) => db.collection(c).get()));
  const col = Object.fromEntries(COLECCIONES.map((c, i) => [c, snaps[i]!])) as Record<(typeof COLECCIONES)[number], QuerySnapshot>;
  const porId = (s: QuerySnapshot) => new Map(s.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));
  const guardian = porId(col.guardians);
  const repo = porId(col.repositories);
  const sub = porId(col.submissions);
  const adm = porId(col.admissibility);
  const presente = new Set(col.checkins.docs.map((c) => `${c.get("participantId")}_${c.get("dia")}`));
  const hizoCheckin = (pid: string, dia: string) => presente.has(`${pid}_${dia}`);

  const participantes: Fila[] = col.participants.docs.map((d) => {
    const p = d.data();
    const creado = fechaDe(p.createdAt);
    const fila: Fila = {
      participant_id: d.id,
      team_id: p.teamId ?? null,
      categoria: p.categoria,
      nivel: p.nivel,
      ciudad: p.ciudad,
      institucion: p.institucion,
      rol_preferido: p.perfilTecnico?.rolPreferido ?? null,
      nivel_desarrollo: p.perfilTecnico?.niveles?.desarrollo ?? null,
      nivel_n8n: p.perfilTecnico?.niveles?.n8n ?? null,
      nivel_ia: p.perfilTecnico?.niveles?.ia ?? null,
      nivel_diseno: p.perfilTecnico?.niveles?.diseno ?? null,
      hackathons_previos: p.perfilTecnico?.hackathonsPrevios ?? 0,
      modo_inscripcion: p.modoInscripcion ?? null,
      en_lista_espera: b(p.enListaEspera),
      autorizacion_estado: p.categoria === "JUNIOR" ? ((guardian.get(d.id)?.estado as string) ?? "pendiente") : null,
      checkin_viernes: b(hizoCheckin(d.id, "viernes")),
      checkin_sabado: b(hizoCheckin(d.id, "sabado")),
      fecha_inscripcion: creado?.toISOString() ?? null,
      fecha_inscripcion_dia: creado ? diaEcuador(creado) : null,
    };
    if (opts.conContacto) Object.assign(fila, { nombres: p.nombres, apellidos: p.apellidos, email: p.email, celular: p.celular });
    return fila;
  });

  const mentorias: Fila[] = col.mentor_requests.docs.map((d) => {
    const m = d.data();
    const abierta = fechaDe(m.abiertaAt);
    const atendida = fechaDe(m.atendidaAt);
    return {
      request_id: d.id,
      team_id: m.teamId,
      tema: m.tema,
      estado: m.estado,
      abierta_at: abierta?.toISOString() ?? null,
      atendida_at: atendida?.toISOString() ?? null,
      minutos_espera: abierta && atendida ? Math.round((atendida.getTime() - abierta.getTime()) / 60_000) : null,
    };
  });

  const fechas = { kickoff: fecha("kickoff"), freeze: fecha("codeFreeze") };
  const equipos: Fila[] = col.teams.docs.map((d) => {
    const t = d.data();
    const r = repo.get(d.id);
    const s = (r?.ultimoSnapshot ?? null) as Record<string, unknown> | null;
    const a = adm.get(d.id);
    const e = sub.get(d.id);
    const miembros = col.participants.docs.filter((p) => p.get("teamId") === d.id);
    const presentes = miembros.filter((p) => hizoCheckin(p.id, "viernes") || hizoCheckin(p.id, "sabado")).length;
    const abiertas = col.mentor_requests.docs.filter((m) => m.get("teamId") === d.id && m.get("estado") === "abierta");
    const masAntigua =
      abiertas
        .map((m) => fechaDe(m.get("abiertaAt")))
        .filter((x): x is Date => !!x)
        .sort((x, y) => x.getTime() - y.getTime())[0] ?? null;
    const autores = ((s?.autores as string[]) ?? []).length;
    const sem = semaforo(
      {
        repoRegistrado: !!r?.validado,
        checkpoint1: (s?.checkpoint1 as string) ?? null,
        checkpoint2: (s?.checkpoint2 as string) ?? null,
        admisibilidad: a ? { a1: !!a.a1, a2: !!a.a2, a3: !!a.a3, a4: (a.a4 as boolean | null) ?? null, a5: !!a.a5 } : null,
        ultimoCommitAt: fechaDe(s?.ultimoCommitAt),
        autores,
        commitsVentana: Number(s?.commitsEnVentana ?? 0),
        mentoriaMasAntiguaSinAtender: masAntigua,
      },
      opts.ahora,
      fechas,
    );
    return {
      team_id: d.id,
      nombre: t.nombre,
      track: t.track,
      categoria: t.categoria,
      estado: t.estado,
      miembros: t.miembros ?? miembros.length,
      requiere_adulto: b(t.requiereAdulto),
      adulto_asignado: b(t.adultoResponsableId),
      room_id: t.roomId ?? null,
      finalista: b(t.finalista),
      repo_registrado: b(r?.validado),
      checkpoint1: (s?.checkpoint1 as string) ?? null,
      checkpoint2: (s?.checkpoint2 as string) ?? null,
      commits_ventana: Number(s?.commitsEnVentana ?? 0),
      autores,
      ultimo_commit_at: iso(s?.ultimoCommitAt),
      entregado: b(e?.tagSha),
      tag_sha: (e?.tagSha as string) ?? null,
      tag_movido_tras_freeze: b(e?.tagMovidoTrasFreeze),
      a1: a ? b(a.a1) : null,
      a2: a ? b(a.a2) : null,
      a3: a ? b(a.a3) : null,
      a4: a && a.a4 !== null && a.a4 !== undefined ? b(a.a4) : null,
      a5: a ? b(a.a5) : null,
      presentes,
      mentorias_abiertas: abiertas.length,
      semaforo: sem.color,
      semaforo_motivos: sem.motivos.join("; "),
    };
  });

  // Solo el último snapshot por equipo (el historial completo queda en Firestore).
  const ultimo = new Map<string, QueryDocumentSnapshot>();
  for (const s of col.repo_snapshots.docs) {
    const prev = ultimo.get(s.get("teamId"));
    if (!prev || (fechaDe(s.get("tomadoEn"))?.getTime() ?? 0) > (fechaDe(prev.get("tomadoEn"))?.getTime() ?? 0)) ultimo.set(s.get("teamId"), s);
  }
  const repos_snapshot: Fila[] = [...ultimo.values()].map((s) => {
    const alertas = (s.get("alertas") ?? []) as { tipo: string; nivel: string }[];
    return {
      team_id: s.get("teamId"),
      tomado_en: iso(s.get("tomadoEn")),
      commits_en_ventana: s.get("commitsEnVentana") ?? 0,
      autores: ((s.get("autores") ?? []) as string[]).length,
      ultimo_commit_at: iso(s.get("ultimoCommitAt")),
      checkpoint1: s.get("checkpoint1") ?? null,
      checkpoint2: s.get("checkpoint2") ?? null,
      alertas_rojas: alertas.filter((x) => x.nivel === "roja").length,
      alertas_ambar: alertas.filter((x) => x.nivel === "ambar").length,
      tipos_alerta: [...new Set(alertas.map((x) => x.tipo))].join("|"),
    };
  });

  const commits_por_hora: Fila[] = [...ultimo.values()].flatMap((s) =>
    Object.entries((s.get("commitsPorHora") ?? {}) as Record<string, number>).map(([hora, commits]) => ({ team_id: s.get("teamId"), hora, commits })),
  );

  const entregas: Fila[] = col.submissions.docs
    .filter((d) => d.get("tagSha"))
    .map((d) => ({
      team_id: d.id,
      enviado_at: iso(d.get("enviadoAt")),
      demo: d.get("demoUrl") === "ejecucion-local" ? "ejecucion-local" : "desplegada",
      tiene_video: b(d.get("videoUrl")),
      tag_sha: d.get("tagSha"),
      tag_commit_at: iso(d.get("tagCommitAt")),
      tag_movido_tras_freeze: b(d.get("tagMovidoTrasFreeze")),
      datos_sinteticos: b(d.get("declaraciones.datosSinteticos")),
      prior_work: b(d.get("declaraciones.priorWork")),
      ai_usage: b(d.get("declaraciones.aiUsage")),
    }));

  const puntajes: Fila[] = opts.conPuntajes
    ? col.scores.docs.map((d) => {
        const s = d.data();
        return {
          ronda: s.ronda,
          room_id: s.roomId,
          team_id: s.teamId,
          judge_id: s.judgeId,
          c1: s.c1,
          c2: s.c2,
          c3: s.c3,
          c4: s.c4,
          c5: s.c5,
          c6: s.c6,
          total: s.total ?? scoreTotal(s as Niveles),
          tiempo_usado_seg: s.tiempoUsadoSeg ?? 0,
          demo_en_vivo: b(s.demoEnVivo),
        };
      })
    : [];

  const presentaciones: Fila[] = col.presentation_slots.docs.map((d) => {
    const s = d.data();
    const programada = fechaDe(s.horaProgramada);
    const inicio = fechaDe(s.inicioReal);
    // Atraso: inicio real (o "ahora" si ya debió empezar y no empezó) menos la hora programada.
    const referencia = inicio ?? (programada && opts.ahora > programada ? opts.ahora : null);
    return {
      room_id: s.roomId,
      team_id: s.teamId,
      ronda: s.ronda,
      orden: s.orden,
      hora_programada: programada?.toISOString() ?? null,
      inicio_real: inicio?.toISOString() ?? null,
      fin_real: iso(s.finReal),
      duracion_seg: s.duracionSeg ?? null,
      atraso_min: programada && referencia ? Math.max(0, Math.round((referencia.getTime() - programada.getTime()) / 60_000)) : 0,
    };
  });

  const conflictosDe = (jid: string) => col.conflicts.docs.filter((c) => c.get("judgeId") === jid);
  const jueces: Fila[] = col.judges.docs.map((d) => ({
    judge_id: d.id,
    room_id: d.get("roomId") ?? null,
    final: b(d.get("final")),
    perfil: d.get("perfil") ?? null,
    conflictos: conflictosDe(d.id).length,
    conflictos_en_sala: conflictosDe(d.id).filter((c) =>
      col.presentation_slots.docs.some((s) => s.get("teamId") === c.get("teamId") && s.get("roomId") === d.get("roomId")),
    ).length,
    evaluaciones: col.scores.docs.filter((s) => s.get("judgeId") === d.id).length,
  }));

  // KPIs por hora (hora de Ecuador): inscripciones, check-ins, commits, mentorías abiertas, entregas.
  const horas = new Map<string, Fila>();
  const sumar = (momento: Date | string | null, campo: string, n = 1) => {
    if (!momento) return;
    const hora = typeof momento === "string" ? momento : horaEcuador(momento);
    const f = horas.get(hora) ?? { hora, inscripciones: 0, checkins: 0, commits: 0, mentorias: 0, entregas: 0 };
    f[campo] = Number(f[campo]) + n;
    horas.set(hora, f);
  };
  for (const p of col.participants.docs) if (!p.get("enListaEspera")) sumar(fechaDe(p.get("createdAt")), "inscripciones");
  for (const c of col.checkins.docs) sumar(fechaDe(c.get("timestamp")), "checkins");
  for (const c of commits_por_hora) sumar(String(c.hora), "commits", Number(c.commits));
  for (const m of col.mentor_requests.docs) sumar(fechaDe(m.get("abiertaAt")), "mentorias");
  for (const s of col.submissions.docs) if (s.get("tagSha")) sumar(fechaDe(s.get("enviadoAt")), "entregas");
  const kpis_por_hora = [...horas.values()].sort((x, y) => String(x.hora).localeCompare(String(y.hora)));

  return { participantes, equipos, repos_snapshot, entregas, puntajes, kpis_por_hora, commits_por_hora, mentorias, presentaciones, jueces };
}

export const CUPO_PERSONAS = EVENT.cupo.maxPersonas;

/** CSV RFC 4180 con BOM (Excel en español abre bien las tildes) y protección contra inyección de fórmulas. */
export function aCsv(filas: Fila[]): string {
  if (!filas.length) return "﻿";
  const columnas = [...new Set(filas.flatMap((f) => Object.keys(f)))];
  const celda = (x: unknown) => {
    if (x === null || x === undefined) return "";
    const s = String(x);
    const seguro = typeof x === "string" && /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n;]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  return "﻿" + [columnas.join(","), ...filas.map((f) => columnas.map((c) => celda(f[c])).join(","))].join("\r\n");
}
