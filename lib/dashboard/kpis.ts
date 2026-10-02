/**
 * KPIs del dashboard 360 (prompt §6), calculados SOLO a partir del dataset plano
 * (lib/dashboard/dataset.ts). Así cada valor que muestra /admin se puede verificar con SQL sobre
 * los CSV exportados (docs/DATASET.md, scripts/verificar-kpis.ts).
 */

export type Fila = Record<string, string | number | boolean | null>;

export interface Dataset {
  participantes: Fila[];
  equipos: Fila[];
  repos_snapshot: Fila[];
  entregas: Fila[];
  puntajes: Fila[];
  kpis_por_hora: Fila[];
  commits_por_hora: Fila[];
  mentorias: Fila[];
  presentaciones: Fila[];
  jueces: Fila[];
}

// ---------------------------------------------------------------------------
// Semáforo de riesgo por equipo
// ---------------------------------------------------------------------------

export type Color = "rojo" | "ambar" | "verde";

export interface EntradaSemaforo {
  repoRegistrado: boolean;
  checkpoint1: string | null; // cumplido | pendiente | vencido
  checkpoint2: string | null;
  admisibilidad: { a1: boolean; a2: boolean; a3: boolean; a4: boolean | null; a5: boolean } | null;
  ultimoCommitAt: Date | null;
  autores: number;
  commitsVentana: number;
  mentoriaMasAntiguaSinAtender: Date | null;
}

export interface Fechas {
  kickoff: Date;
  freeze: Date;
}

/**
 * Rojo: sin repo 2 h después del kick-off, checkpoint vencido o falla de admisibilidad.
 * Ámbar: sin commits en 3 h durante la ventana, un solo autor o mentoría sin atender > 30 min.
 * Verde: al día. Siempre devuelve los motivos en texto (no solo el color).
 */
export function semaforo(e: EntradaSemaforo, ahora: Date, f: Fechas): { color: Color; motivos: string[] } {
  const rojos: string[] = [];
  const ambar: string[] = [];
  const h = 3600_000;
  if (!e.repoRegistrado && ahora.getTime() >= f.kickoff.getTime() + 2 * h) rojos.push("Sin repositorio 2 h después del kick-off");
  if (e.checkpoint1 === "vencido") rojos.push("Checkpoint 1 vencido");
  if (e.checkpoint2 === "vencido") rojos.push("Checkpoint 2 vencido");
  if (e.admisibilidad) {
    const fallas: string[] = (["a1", "a2", "a3", "a5"] as const).filter((k) => !e.admisibilidad![k]).map((k) => k.toUpperCase());
    if (e.admisibilidad.a4 === false) fallas.push("A4");
    if (fallas.length) rojos.push(`Falla de admisibilidad: ${fallas.join(", ")}`);
  }
  const enVentana = ahora >= f.kickoff && ahora < f.freeze;
  if (enVentana && e.repoRegistrado && ahora.getTime() - f.kickoff.getTime() >= 3 * h) {
    if (!e.ultimoCommitAt || ahora.getTime() - e.ultimoCommitAt.getTime() >= 3 * h) ambar.push("Sin commits en las últimas 3 h");
  }
  if (e.commitsVentana > 0 && e.autores === 1) ambar.push("Un solo autor en los commits");
  if (e.mentoriaMasAntiguaSinAtender && ahora.getTime() - e.mentoriaMasAntiguaSinAtender.getTime() > 30 * 60_000) {
    ambar.push("Mentoría pedida sin atender hace más de 30 min");
  }
  if (rojos.length) return { color: "rojo", motivos: [...rojos, ...ambar] };
  if (ambar.length) return { color: "ambar", motivos: ambar };
  return { color: "verde", motivos: ["Al día"] };
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

const v = (x: Fila[keyof Fila] | undefined) => x === true || x === 1 || x === "1" || x === "true";
const contar = (filas: Fila[], f: (r: Fila) => boolean) => filas.filter(f).length;
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 1000) / 10);
const prom = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0);
const vacio = (x: Fila[keyof Fila] | undefined) => x === null || x === undefined || x === "";

function agrupar(filas: Fila[], clave: string): Record<string, number> {
  const r: Record<string, number> = {};
  for (const f of filas) {
    const k = String(f[clave] ?? "sin dato");
    r[k] = (r[k] ?? 0) + 1;
  }
  return r;
}

export function calcularKpis(d: Dataset, opts: { cupoPersonas: number }) {
  const inscritos = d.participantes.filter((p) => !v(p.en_lista_espera));
  const equiposActivos = d.equipos.filter((e) => e.estado !== "descalificado");
  const juniors = inscritos.filter((p) => p.categoria === "JUNIOR");

  const convocatoria = {
    inscritosTotales: inscritos.length,
    listaEspera: d.participantes.length - inscritos.length,
    equiposCompletos: contar(d.equipos, (e) => e.estado === "completo"),
    individualesSinEquipo: contar(inscritos, (p) => vacio(p.team_id)),
    ocupacionCupoPct: pct(inscritos.length, opts.cupoPersonas),
    inscripcionesPorDia: Object.entries(agrupar(inscritos, "fecha_inscripcion_dia"))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, n]) => ({ dia, n })),
    porTrack: agrupar(d.equipos, "track"),
    porCategoria: agrupar(inscritos, "categoria"),
    autorizacionesJuniorPendientes: contar(juniors, (p) => p.autorizacion_estado !== "validado"),
  };

  const perfil = {
    equiposSinConstruccion: 0,
    heatmap: d.equipos.map((e) => {
      const m = d.participantes.filter((p) => p.team_id === e.team_id);
      return {
        team_id: String(e.team_id),
        nombre: String(e.nombre),
        desarrollo: prom(m.map((p) => Number(p.nivel_desarrollo))),
        n8n: prom(m.map((p) => Number(p.nivel_n8n))),
        ia: prom(m.map((p) => Number(p.nivel_ia))),
        diseno: prom(m.map((p) => Number(p.nivel_diseno))),
        rolesCubiertos: [...new Set(m.map((p) => String(p.rol_preferido)))].sort(),
        // Perfil de construcción: alguien con nivel ≥ 3 en desarrollo.
        sinConstruccion: !m.some((p) => Number(p.nivel_desarrollo) >= 3),
      };
    }),
  };

  perfil.equiposSinConstruccion = perfil.heatmap.filter((h) => h.sinConstruccion).length;

  const checkin = {
    presentes: contar(inscritos, (p) => v(p.checkin_viernes) || v(p.checkin_sabado)),
    porEquipo: equiposActivos.map((e) => ({
      team_id: String(e.team_id),
      nombre: String(e.nombre),
      presentes: Number(e.presentes),
      miembros: Number(e.miembros),
    })),
    equiposConMenosDe2: contar(equiposActivos, (e) => Number(e.presentes) < 2),
  };

  const tipos = (r: Fila) => String(r.tipos_alerta ?? "");
  const repositorios = {
    conRepoPct: pct(contar(equiposActivos, (e) => v(e.repo_registrado)), equiposActivos.length),
    checkpoint1Pct: pct(contar(equiposActivos, (e) => e.checkpoint1 === "cumplido"), equiposActivos.length),
    checkpoint2Pct: pct(contar(equiposActivos, (e) => e.checkpoint2 === "cumplido"), equiposActivos.length),
    commitsTotales: d.kpis_por_hora.reduce((n, h) => n + Number(h.commits ?? 0), 0),
    commitsPorHora: d.kpis_por_hora.filter((h) => Number(h.commits) > 0).map((h) => ({ hora: String(h.hora), commits: Number(h.commits) })),
    autoresPorEquipo: equiposActivos.map((e) => ({ nombre: String(e.nombre), autores: Number(e.autores) })),
    alertas: {
      repoAntesKickoff: contar(d.repos_snapshot, (r) => tipos(r).includes("repo-antes-kickoff")),
      secretos: contar(d.repos_snapshot, (r) => tipos(r).includes("secreto") || tipos(r).includes("env-versionado")),
      sinCommits3h: contar(d.repos_snapshot, (r) => tipos(r).includes("sin-commits-3h")),
    },
  };

  const atendidas = d.mentorias.filter((m) => !vacio(m.minutos_espera));
  const mentoria = {
    abiertas: contar(d.mentorias, (m) => m.estado === "abierta"),
    tiempoMedioAtencionMin: prom(atendidas.map((m) => Number(m.minutos_espera))),
    temas: Object.entries(agrupar(d.mentorias, "tema"))
      .sort(([, a], [, b]) => b - a)
      .map(([tema, n]) => ({ tema, n })),
  };

  const entregas = {
    recibidas: d.entregas.length,
    equiposActivos: equiposActivos.length,
    admisibilidad: d.equipos
      .filter((e) => !vacio(e.a1))
      .map((e) => ({ nombre: String(e.nombre), a1: v(e.a1), a2: v(e.a2), a3: v(e.a3), a4: vacio(e.a4) ? null : v(e.a4), a5: v(e.a5) })),
    tagsMovidosTrasFreeze: contar(d.entregas, (s) => v(s.tag_movido_tras_freeze)),
    fallasAdmisibilidad: 0,
  };
  entregas.fallasAdmisibilidad = entregas.admisibilidad.filter((a) => !a.a1 || !a.a2 || !a.a3 || a.a4 === false || !a.a5).length;

  const salas = [...new Set(d.presentaciones.map((p) => String(p.room_id)))].sort();
  const jurado = {
    evaluacionesRegistradas: contar(d.puntajes, (p) => p.ronda === "semifinal"),
    evaluacionesPorSala: salas.map((s) => {
      const turnos = contar(d.presentaciones, (p) => p.room_id === s);
      const juecesSala = d.jueces.filter((j) => (s === "final" ? v(j.final) : j.room_id === s));
      return {
        room_id: s,
        registradas: contar(d.puntajes, (p) => p.room_id === s),
        esperadas: juecesSala.reduce((n, j) => n + turnos - (s === "final" ? 0 : Number(j.conflictos_en_sala ?? 0)), 0),
      };
    }),
    juecesConConflicto: contar(d.jueces, (j) => Number(j.conflictos) > 0),
    tiempoMedioPresentacionSeg: Math.round(prom(d.presentaciones.filter((p) => Number(p.duracion_seg) > 0).map((p) => Number(p.duracion_seg)))),
    salasAtrasadas: [...new Set(d.presentaciones.filter((p) => Number(p.atraso_min) > 10).map((p) => String(p.room_id)))].sort(),
  };

  const semaforoResumen = {
    rojo: contar(equiposActivos, (e) => e.semaforo === "rojo"),
    ambar: contar(equiposActivos, (e) => e.semaforo === "ambar"),
    verde: contar(equiposActivos, (e) => e.semaforo === "verde"),
  };

  return { convocatoria, perfil, checkin, repositorios, mentoria, entregas, jurado, semaforo: semaforoResumen };
}

export type Kpis = ReturnType<typeof calcularKpis>;
