import { TRACK_CODES, type RolEquipo } from "@/config/event";
import { requireAdmin } from "@/lib/auth/session";
import { FormularioAccion } from "@/components/admin/accion";
import { CampoSelect, CampoTexto, claseInput } from "@/components/formulario";
import { asignarAdulto, asignarAEquipo, cambiarTrackAdmin, crearEquipoAdmin, fusionarEquipos } from "@/lib/admin/acciones";
import { NOMBRE_ROL } from "@/lib/content/perfil";
import { construirDataset } from "@/lib/dashboard/dataset";
import { ahora } from "@/lib/event/reloj";
import { adminDb } from "@/lib/firebase/admin";

export const metadata = { title: "Equipos" };
export const dynamic = "force-dynamic";

const COLOR: Record<string, string> = { rojo: "text-danger", ambar: "text-accent-text", verde: "text-positive-text" };
const NOMBRE: Record<string, string> = { rojo: "Rojo", ambar: "Ámbar", verde: "Verde" };

export default async function Equipos() {
  await requireAdmin("/admin/equipos");
  const db = adminDb();
  const [dataset, participantes, staff] = await Promise.all([
    construirDataset(db, { ahora: ahora(), conContacto: false, conPuntajes: false }),
    db.collection("participants").where("teamId", "==", null).get(),
    db.collection("staff").get(),
  ]);
  const activos = dataset.equipos.filter((e) => e.estado !== "fusionado");
  const conLugar = activos.filter((e) => Number(e.miembros) < 5);
  const opcionesEquipo = activos.map((e) => ({ valor: String(e.team_id), etiqueta: `${String(e.nombre)} (${String(e.miembros)})` }));
  const adultos = staff.docs.filter((s) => ((s.get("roles") ?? []) as string[]).some((r) => ["mentor", "comite", "admin"].includes(r)));
  const individuales = participantes.docs.filter((p) => !p.get("enListaEspera"));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Equipos</h1>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3">Equipo</th>
              <th scope="col" className="py-2 pr-3">Integrantes</th>
              <th scope="col" className="py-2 pr-3">Semáforo</th>
              <th scope="col" className="py-2 pr-3">Track</th>
              <th scope="col" className="py-2">Adulto responsable</th>
            </tr>
          </thead>
          <tbody>
            {activos.map((e) => (
              <tr key={String(e.team_id)} className="border-b border-border align-top">
                <td className="py-2 pr-3 font-medium">
                  {String(e.nombre)}
                  <span className="block text-xs text-muted">{String(e.categoria)}</span>
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {String(e.miembros)} · {e.estado === "completo" ? "completo" : "incompleto"}
                </td>
                <td className={`py-2 pr-3 ${COLOR[String(e.semaforo)]}`}>
                  <span className="font-semibold">{NOMBRE[String(e.semaforo)]}</span>
                  <span className="block text-xs">{String(e.semaforo_motivos)}</span>
                </td>
                <td className="py-2 pr-3">
                  <FormularioAccion accion={cambiarTrackAdmin.bind(null, String(e.team_id))} etiqueta="Cambiar" className="flex items-center gap-2">
                    <label htmlFor={`track-${e.team_id}`} className="sr-only">
                      Track de {String(e.nombre)}
                    </label>
                    <select id={`track-${e.team_id}`} name="track" defaultValue={String(e.track)} className={`${claseInput} w-20 py-1`}>
                      {TRACK_CODES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </FormularioAccion>
                </td>
                <td className="py-2">
                  {e.requiere_adulto ? (
                    <FormularioAccion accion={asignarAdulto.bind(null, String(e.team_id))} etiqueta="Guardar" className="flex flex-wrap items-center gap-2">
                      <label htmlFor={`adulto-${e.team_id}`} className="sr-only">
                        Adulto responsable de {String(e.nombre)}
                      </label>
                      <select id={`adulto-${e.team_id}`} name="adulto" defaultValue="" className={`${claseInput} w-44 py-1`}>
                        <option value="">{e.adulto_asignado ? "Asignado (cambiar…)" : "Sin asignar: elegir"}</option>
                        {adultos.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.get("nombre") ?? a.id}
                          </option>
                        ))}
                      </select>
                    </FormularioAccion>
                  ) : (
                    <span className="text-muted">No requiere (sin Junior)</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="matchmaking" className="mt-10">
        <h2 id="matchmaking" className="text-xl font-semibold">
          Matchmaking · {individuales.length} personas sin equipo
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3">Persona</th>
                <th scope="col" className="py-2 pr-3">Rol preferido</th>
                <th scope="col" className="py-2 pr-3">Niveles (dev · n8n · IA · diseño)</th>
                <th scope="col" className="py-2">Asignar</th>
              </tr>
            </thead>
            <tbody>
              {individuales.map((p) => {
                const n = (p.get("perfilTecnico.niveles") ?? {}) as Record<string, number>;
                return (
                  <tr key={p.id} className="border-b border-border">
                    <td className="py-2 pr-3">
                      {p.get("nombres")} {p.get("apellidos")} <span className="text-xs text-muted">({p.get("categoria")})</span>
                    </td>
                    <td className="py-2 pr-3">{NOMBRE_ROL[p.get("perfilTecnico.rolPreferido") as RolEquipo]}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {n.desarrollo} · {n.n8n} · {n.ia} · {n.diseno}
                    </td>
                    <td className="py-2">
                      <FormularioAccion accion={asignarAEquipo.bind(null, p.id)} etiqueta="Asignar" className="flex flex-wrap items-center gap-2">
                        <label htmlFor={`eq-${p.id}`} className="sr-only">
                          Equipo para {p.get("nombres")}
                        </label>
                        <select id={`eq-${p.id}`} name="teamId" defaultValue="" className={`${claseInput} w-52 py-1`}>
                          <option value="">Elegir equipo</option>
                          {conLugar.map((e) => (
                            <option key={String(e.team_id)} value={String(e.team_id)}>
                              {String(e.nombre)} ({String(e.track)}, {String(e.miembros)})
                            </option>
                          ))}
                        </select>
                      </FormularioAccion>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="crear" className="rounded border border-border bg-surface p-4">
          <h2 id="crear" className="text-lg font-semibold">
            Crear equipo
          </h2>
          <div className="mt-3">
            <FormularioAccion accion={crearEquipoAdmin} etiqueta="Crear equipo">
              <CampoTexto id="nuevo-nombre" name="nombre" etiqueta="Nombre" />
              <CampoSelect id="nuevo-track" name="track" etiqueta="Track" opciones={TRACK_CODES.map((t) => ({ valor: t, etiqueta: t }))} />
            </FormularioAccion>
          </div>
        </section>
        <section aria-labelledby="fusionar" className="rounded border border-border bg-surface p-4">
          <h2 id="fusionar" className="text-lg font-semibold">
            Fusionar equipos
          </h2>
          <p className="mt-1 text-sm text-muted">Los integrantes del origen pasan al destino (máximo 5 en total).</p>
          <div className="mt-3">
            <FormularioAccion accion={fusionarEquipos} etiqueta="Fusionar">
              <CampoSelect id="origen" name="origen" etiqueta="Equipo origen" opciones={opcionesEquipo} />
              <CampoSelect id="destino" name="destino" etiqueta="Equipo destino" opciones={opcionesEquipo} />
            </FormularioAccion>
          </div>
        </section>
      </div>
    </div>
  );
}
