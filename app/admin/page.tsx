import Link from "next/link";
import { tieneRol } from "@/lib/auth/roles";
import { requireAdmin } from "@/lib/auth/session";
import { Barras, Linea } from "@/components/dashboard/graficos";
import { TiempoReal } from "@/components/tiempo-real";
import { construirDataset, CUPO_PERSONAS } from "@/lib/dashboard/dataset";
import { calcularKpis, type Fila } from "@/lib/dashboard/kpis";
import { ahora } from "@/lib/event/reloj";
import { adminDb } from "@/lib/firebase/admin";
import { NOMBRE_ROL } from "@/lib/content/perfil";
import type { RolEquipo } from "@/config/event";

export const metadata = { title: "Dashboard 360" };
export const dynamic = "force-dynamic";

const COLOR_SEMAFORO: Record<string, string> = { rojo: "text-danger", ambar: "text-accent-text", verde: "text-positive-text" };
const NOMBRE_SEMAFORO: Record<string, string> = { rojo: "Rojo", ambar: "Ámbar", verde: "Verde" };

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: string | number; detalle?: string }) {
  return (
    <div className="rounded border border-border bg-surface p-3">
      <dt className="text-sm text-muted">{titulo}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{valor}</dd>
      {detalle && <dd className="text-xs text-muted">{detalle}</dd>}
    </div>
  );
}

function Bloque({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="text-xl font-semibold">
        {titulo}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Celda de nivel 1–4 para el mapa de calor: color de fondo más el número (no solo color). */
function CeldaNivel({ v }: { v: number }) {
  const fondo = v >= 3 ? "bg-positive/25" : v >= 2 ? "bg-accent/20" : "bg-danger/15";
  return <td className={`px-2 py-1 text-center tabular-nums ${fondo}`}>{v || "—"}</td>;
}

export default async function Admin() {
  const id = await requireAdmin("/admin");
  const comite = tieneRol(id, "admin", "comite");
  const t = ahora();
  const dataset = await construirDataset(adminDb(), { ahora: t, conContacto: false, conPuntajes: comite });
  const k = calcularKpis(dataset, { cupoPersonas: CUPO_PERSONAS });
  const nombre = Object.fromEntries(dataset.equipos.map((e) => [String(e.team_id), String(e.nombre)]));
  const colecciones = ["participants", "teams", "checkins", "repositories", "submissions", "mentor_requests", "presentation_slots", ...(comite ? ["scores"] : [])];
  const orden = { rojo: 0, ambar: 1, verde: 2 } as Record<string, number>;
  const equipos = [...dataset.equipos].sort((a, b) => (orden[String(a.semaforo)] ?? 3) - (orden[String(b.semaforo)] ?? 3));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard 360</h1>
          <TiempoReal colecciones={colecciones} />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a href="/api/admin/exportar?formato=csv" className="rounded border border-border bg-surface px-3 py-2 font-medium">
            Exportar dataset (CSV)
          </a>
          <a href="/api/admin/exportar?formato=xlsx" className="rounded border border-border bg-surface px-3 py-2 font-medium">
            Exportar dataset (XLSX)
          </a>
        </div>
      </div>

      <Bloque id="riesgo" titulo="Semáforo de riesgo por equipo">
        <p className="text-sm">
          <span className="font-semibold text-danger">{k.semaforo.rojo} en rojo</span> ·{" "}
          <span className="font-semibold text-accent-text">{k.semaforo.ambar} en ámbar</span> ·{" "}
          <span className="font-semibold text-positive-text">{k.semaforo.verde} al día</span>
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3">Equipo</th>
                <th scope="col" className="py-2 pr-3">Track</th>
                <th scope="col" className="py-2 pr-3">Estado</th>
                <th scope="col" className="py-2 pr-3">Motivo</th>
                <th scope="col" className="py-2 pr-3">Commits</th>
                <th scope="col" className="py-2 pr-3">Autores</th>
                <th scope="col" className="py-2">Presentes</th>
              </tr>
            </thead>
            <tbody>
              {equipos.map((e: Fila) => (
                <tr key={String(e.team_id)} className="border-b border-border align-top">
                  <td className="py-2 pr-3 font-medium">{String(e.nombre)}</td>
                  <td className="py-2 pr-3">{String(e.track)}</td>
                  <td className={`py-2 pr-3 font-semibold ${COLOR_SEMAFORO[String(e.semaforo)]}`}>{NOMBRE_SEMAFORO[String(e.semaforo)]}</td>
                  <td className="py-2 pr-3">{String(e.semaforo_motivos)}</td>
                  <td className="py-2 pr-3 tabular-nums">{String(e.commits_ventana)}</td>
                  <td className="py-2 pr-3 tabular-nums">{String(e.autores)}</td>
                  <td className="py-2 tabular-nums">
                    {String(e.presentes)}/{String(e.miembros)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloque>

      <Bloque id="convocatoria" titulo="Convocatoria">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <Kpi titulo="Inscritos" valor={k.convocatoria.inscritosTotales} detalle={k.convocatoria.listaEspera ? `${k.convocatoria.listaEspera} en lista de espera` : undefined} />
          <Kpi titulo="Equipos completos" valor={k.convocatoria.equiposCompletos} />
          <Kpi titulo="Sin equipo" valor={k.convocatoria.individualesSinEquipo} />
          <Kpi titulo="Ocupación del cupo" valor={`${k.convocatoria.ocupacionCupoPct} %`} detalle={`de ${CUPO_PERSONAS} personas`} />
          <Kpi titulo="Autorizaciones Junior pendientes" valor={k.convocatoria.autorizacionesJuniorPendientes} />
          <Kpi titulo="Junior" valor={k.convocatoria.porCategoria.JUNIOR ?? 0} />
          <Kpi titulo="Open" valor={k.convocatoria.porCategoria.OPEN ?? 0} />
        </dl>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Linea titulo="Inscripciones por día" datos={k.convocatoria.inscripcionesPorDia} x="dia" y="n" />
          <Barras titulo="Equipos por track" datos={k.convocatoria.porTrack} />
          <Barras titulo="Inscritos por categoría" datos={k.convocatoria.porCategoria} />
        </div>
      </Bloque>

      <Bloque id="perfil" titulo="Perfil técnico">
        <p className="text-sm">
          {k.perfil.equiposSinConstruccion > 0 ? (
            <span className="font-semibold text-danger">{k.perfil.equiposSinConstruccion} equipos sin perfil de construcción (nadie con nivel 3+ en desarrollo).</span>
          ) : (
            "Todos los equipos tienen perfil de construcción."
          )}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Nivel promedio por equipo (1 a 4)</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3">Equipo</th>
                <th scope="col" className="px-2 py-2 text-center">Desarrollo</th>
                <th scope="col" className="px-2 py-2 text-center">n8n</th>
                <th scope="col" className="px-2 py-2 text-center">IA</th>
                <th scope="col" className="px-2 py-2 text-center">Diseño</th>
                <th scope="col" className="py-2 pl-3">Roles cubiertos</th>
              </tr>
            </thead>
            <tbody>
              {k.perfil.heatmap.map((h) => (
                <tr key={h.team_id} className="border-b border-border">
                  <th scope="row" className="py-1 pr-3 font-medium">
                    {h.nombre}
                    {h.sinConstruccion && <span className="block text-xs font-medium text-danger">Sin perfil de construcción</span>}
                  </th>
                  <CeldaNivel v={h.desarrollo} />
                  <CeldaNivel v={h.n8n} />
                  <CeldaNivel v={h.ia} />
                  <CeldaNivel v={h.diseno} />
                  <td className="py-1 pl-3">{h.rolesCubiertos.map((r) => NOMBRE_ROL[r as RolEquipo] ?? r).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloque>

      <Bloque id="checkin" titulo="Check-in">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi titulo="Presentes" valor={`${k.checkin.presentes} de ${k.convocatoria.inscritosTotales}`} />
          <Kpi titulo="Equipos con menos de 2 presentes" valor={k.checkin.equiposConMenosDe2} />
        </dl>
        <p className="mt-2 text-sm">
          <Link href="/admin/checkin" className="underline">
            Abrir el check-in
          </Link>
        </p>
      </Bloque>

      <Bloque id="repos" titulo="Repositorios">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi titulo="Con repo registrado" valor={`${k.repositorios.conRepoPct} %`} />
          <Kpi titulo="Checkpoint 1" valor={`${k.repositorios.checkpoint1Pct} %`} />
          <Kpi titulo="Checkpoint 2" valor={`${k.repositorios.checkpoint2Pct} %`} />
          <Kpi titulo="Repo antes del kick-off" valor={k.repositorios.alertas.repoAntesKickoff} />
          <Kpi titulo="Secretos detectados" valor={k.repositorios.alertas.secretos} />
          <Kpi titulo="Sin commits en 3 h" valor={k.repositorios.alertas.sinCommits3h} />
        </dl>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Linea titulo={`Commits por hora (total ${k.repositorios.commitsTotales})`} datos={k.repositorios.commitsPorHora} x="hora" y="commits" />
          <figure className="rounded border border-border bg-surface p-4">
            <figcaption className="text-sm font-medium">Commits por hora y por equipo</figcaption>
            <div className="mt-2 max-h-48 overflow-auto text-sm">
              <table className="w-full">
                <tbody>
                  {dataset.commits_por_hora.map((c, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-1 pr-2">{nombre[String(c.team_id)] ?? String(c.team_id)}</td>
                      <td className="py-1 pr-2 tabular-nums text-muted">{String(c.hora).replace("T", " ")}h</td>
                      <td className="py-1 tabular-nums">{String(c.commits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </figure>
        </div>
      </Bloque>

      <Bloque id="mentoria" titulo="Mentoría">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi titulo="Solicitudes abiertas" valor={k.mentoria.abiertas} />
          <Kpi titulo="Tiempo medio de atención" valor={`${k.mentoria.tiempoMedioAtencionMin} min`} />
          <Kpi titulo="Temas más pedidos" valor={k.mentoria.temas[0]?.tema ?? "—"} detalle={k.mentoria.temas.map((x) => `${x.tema}: ${x.n}`).join(" · ")} />
        </dl>
      </Bloque>

      <Bloque id="entregas" titulo="Entregas">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi titulo="Entregas recibidas" valor={`${k.entregas.recibidas} de ${k.entregas.equiposActivos}`} />
          <Kpi titulo="Tags movidos tras el freeze" valor={k.entregas.tagsMovidosTrasFreeze} />
          <Kpi titulo="Con falla de admisibilidad" valor={k.entregas.fallasAdmisibilidad} />
        </dl>
        {k.entregas.admisibilidad.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full max-w-3xl text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-3">Equipo</th>
                  {["A1", "A2", "A3", "A4", "A5"].map((a) => (
                    <th key={a} scope="col" className="px-2 py-2 text-center">
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {k.entregas.admisibilidad.map((a) => (
                  <tr key={a.nombre} className="border-b border-border">
                    <td className="py-1 pr-3">{a.nombre}</td>
                    {[a.a1, a.a2, a.a3, a.a4, a.a5].map((x, i) => (
                      <td key={i} className={`px-2 py-1 text-center font-medium ${x === null ? "text-muted" : x ? "text-positive-text" : "text-danger"}`}>
                        {x === null ? "Pendiente" : x ? "Cumple" : "No cumple"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloque>

      <Bloque id="jurado" titulo="Jurado">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi titulo="Jueces con conflicto declarado" valor={k.jurado.juecesConConflicto} />
          <Kpi titulo="Tiempo medio por presentación" valor={k.jurado.tiempoMedioPresentacionSeg ? `${Math.floor(k.jurado.tiempoMedioPresentacionSeg / 60)} min ${k.jurado.tiempoMedioPresentacionSeg % 60} s` : "—"} />
          <Kpi titulo="Salas atrasadas (más de 10 min)" valor={k.jurado.salasAtrasadas.length} detalle={k.jurado.salasAtrasadas.join(", ") || undefined} />
          {comite && <Kpi titulo="Evaluaciones de semifinal" valor={k.jurado.evaluacionesRegistradas} />}
        </dl>
        {comite && (
          <ul className="mt-3 grid gap-1 text-sm">
            {k.jurado.evaluacionesPorSala.map((s) => (
              <li key={s.room_id}>
                {s.room_id}: {s.registradas} de {s.esperadas} evaluaciones
              </li>
            ))}
          </ul>
        )}
      </Bloque>

      {comite && (
        <Bloque id="resultados" titulo="Resultados">
          <p className="text-sm">
            El ranking por sala, los z-scores, el top 5 y los ganadores por premio están en{" "}
            <Link href="/admin/resultados" className="underline">
              Resultados
            </Link>{" "}
            (visible solo para el comité).
          </p>
        </Bloque>
      )}
    </div>
  );
}
