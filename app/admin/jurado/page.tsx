import Link from "next/link";
import type { Timestamp } from "firebase-admin/firestore";
import { TRACK_CODES } from "@/config/event";
import { BotonAccion, FormularioAccion } from "@/components/admin/accion";
import { CampoSelect, CampoTexto, claseInput } from "@/components/formulario";
import { requireAdmin } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { SALA_FINAL, cargarRonda, rondaActiva } from "@/lib/jurado/servicio";
import { aviso, cerrarSala, crearJuez, crearSala, cronometro, generar, mover, reabrirSala, turno } from "./acciones";

export const metadata = { title: "Jurado y salas" };
export const dynamic = "force-dynamic";

const hora = (t: Timestamp | Date | null | undefined) => {
  if (!t) return "—";
  const d = t instanceof Date ? t : t.toDate();
  return new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
};

export default async function AdminJurado() {
  await requireAdmin("/admin/jurado");
  const db = adminDb();
  const ronda = await rondaActiva();
  const [salas, jueces, slots, estados, progreso] = await Promise.all([
    db.collection("rooms").get(),
    db.collection("judges").get(),
    db.collection("presentation_slots").where("ronda", "==", ronda).get(),
    db.collection("public_state").get(),
    cargarRonda(ronda),
  ]);
  const salasRonda = salas.docs.filter((s) => (ronda === "final" ? s.id === SALA_FINAL : s.id !== SALA_FINAL));
  const nombreSala = Object.fromEntries(salas.docs.map((s) => [s.id, s.get("nombre") as string]));
  const crono = Object.fromEntries(estados.docs.filter((d) => d.id.startsWith("cronometro_")).map((d) => [d.get("roomId") as string, d]));
  const avisoActual = estados.docs.find((d) => d.id === "pantalla")?.get("aviso") as string | null | undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Jurado y salas</h1>
      <p className="mt-1 text-sm text-muted">Ronda activa: {ronda === "final" ? "Final" : "Semifinal"}</p>

      <section aria-labelledby="salas" className="mt-8">
        <h2 id="salas" className="text-xl font-semibold">
          Salas y progreso de evaluación
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-4">Sala</th>
                <th scope="col" className="py-2 pr-4">Tracks</th>
                <th scope="col" className="py-2 pr-4">Evaluaciones</th>
                <th scope="col" className="py-2 pr-4">Conflictos</th>
                <th scope="col" className="py-2 pr-4">Estado</th>
                <th scope="col" className="py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {salasRonda.map((s) => {
                const p = progreso.progreso.find((x) => x.roomId === s.id);
                const completo = p && p.esperadas > 0 && p.registradas >= p.esperadas;
                return (
                  <tr key={s.id} className="border-b border-border align-top">
                    <td className="py-2 pr-4 font-medium">{s.get("nombre")}</td>
                    <td className="py-2 pr-4">{(s.get("tracks") as string[]).join(", ")}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {p ? `${p.registradas} de ${p.esperadas}` : "—"} {completo && <span className="text-positive-text">(completas)</span>}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{p?.conflictos ?? 0}</td>
                    <td className={`py-2 pr-4 font-medium ${s.get("cerrada") ? "text-danger" : "text-positive-text"}`}>{s.get("cerrada") ? "Cerrada" : "Abierta"}</td>
                    <td className="py-2">
                      {s.get("cerrada") ? (
                        <FormularioAccion accion={reabrirSala.bind(null, s.id)} etiqueta="Reabrir" className="flex flex-wrap items-end gap-2">
                          <label htmlFor={`motivo-${s.id}`} className="sr-only">
                            Motivo para reabrir {s.get("nombre")}
                          </label>
                          <input id={`motivo-${s.id}`} name="motivo" placeholder="Motivo (auditoría)" className={`${claseInput} w-48 py-1 text-sm`} />
                        </FormularioAccion>
                      ) : (
                        <BotonAccion accion={cerrarSala.bind(null, s.id)} confirmar="¿Cerrar la sala y bloquear sus puntajes?">
                          Cerrar sala
                        </BotonAccion>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <details className="mt-4 rounded border border-border bg-surface p-4">
          <summary className="cursor-pointer font-medium">Crear o editar una sala</summary>
          <div className="mt-4">
            <FormularioAccion accion={crearSala} etiqueta="Guardar sala">
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoTexto id="sala-id" name="id" etiqueta="Identificador" placeholder="sala-1" />
                <CampoTexto id="sala-nombre" name="nombre" etiqueta="Nombre" placeholder="Sala T1" />
              </div>
              <fieldset className="flex flex-wrap gap-4">
                <legend className="mb-1 font-medium">Tracks</legend>
                {TRACK_CODES.map((t) => (
                  <label key={t} className="flex items-center gap-2">
                    <input type="checkbox" name="tracks" value={t} className="accent-navy-700" /> {t}
                  </label>
                ))}
              </fieldset>
            </FormularioAccion>
          </div>
        </details>
      </section>

      <section aria-labelledby="jueces" className="mt-10">
        <h2 id="jueces" className="text-xl font-semibold">
          Jueces
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-4">Nombre</th>
                <th scope="col" className="py-2 pr-4">Perfil</th>
                <th scope="col" className="py-2 pr-4">Sala de semifinal</th>
                <th scope="col" className="py-2">Jurado de la final</th>
              </tr>
            </thead>
            <tbody>
              {jueces.docs.map((j) => (
                <tr key={j.id} className="border-b border-border">
                  <td className="py-2 pr-4">{j.get("nombre")}</td>
                  <td className="py-2 pr-4">{j.get("perfil")}</td>
                  <td className="py-2 pr-4">{nombreSala[j.get("roomId")] ?? "Sin sala"}</td>
                  <td className="py-2">{j.get("final") ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="mt-4 rounded border border-border bg-surface p-4">
          <summary className="cursor-pointer font-medium">Registrar un juez</summary>
          <div className="mt-4">
            <FormularioAccion accion={crearJuez} etiqueta="Registrar juez">
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoTexto id="juez-email" name="email" type="email" etiqueta="Correo" autoComplete="off" />
                <CampoTexto id="juez-nombre" name="nombre" etiqueta="Nombre" autoComplete="off" />
                <CampoSelect
                  id="juez-perfil"
                  name="perfil"
                  etiqueta="Perfil"
                  opciones={[
                    { valor: "tecnico", etiqueta: "Técnico" },
                    { valor: "educativo", etiqueta: "Sector educativo" },
                    { valor: "negocio", etiqueta: "Negocio" },
                  ]}
                />
                <CampoSelect
                  id="juez-sala"
                  name="roomId"
                  etiqueta="Sala de semifinal"
                  opciones={salas.docs.filter((s) => s.id !== SALA_FINAL).map((s) => ({ valor: s.id, etiqueta: s.get("nombre") }))}
                />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="final" className="accent-navy-700" /> Forma parte del jurado de la final
              </label>
            </FormularioAccion>
          </div>
        </details>
      </section>

      <section aria-labelledby="orden" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="orden" className="text-xl font-semibold">
            Orden de presentación y cronómetro
          </h2>
          {ronda === "semifinal" && (
            <BotonAccion accion={generar.bind(null, "semifinal")} confirmar="Esto reemplaza el orden actual de la semifinal. ¿Continuar?">
              Generar orden de semifinal
            </BotonAccion>
          )}
        </div>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          {salasRonda.map((s) => {
            const lista = slots.docs.filter((x) => x.get("roomId") === s.id).sort((a, b) => a.get("orden") - b.get("orden"));
            const c = crono[s.id];
            return (
              <div key={s.id} className="rounded border border-border bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{s.get("nombre")}</h3>
                  <Link href={`/pantalla?sala=${s.id}`} className="text-sm underline" target="_blank">
                    Abrir pantalla de la sala
                  </Link>
                </div>
                <div className="mt-3 rounded border border-border p-3 text-sm">
                  <p>
                    En pantalla: <strong>{c?.get("equipo") ?? "nadie"}</strong>
                    {c && (c.get("corriendo") ? " · corriendo" : " · detenido")}
                  </p>
                  {c && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <BotonAccion accion={cronometro.bind(null, s.id, "iniciar")}>Iniciar</BotonAccion>
                      <BotonAccion accion={cronometro.bind(null, s.id, "pausar")}>Pausar</BotonAccion>
                      <BotonAccion accion={cronometro.bind(null, s.id, "reiniciar")}>Reiniciar</BotonAccion>
                      <BotonAccion accion={cronometro.bind(null, s.id, "terminar")}>Terminar</BotonAccion>
                    </div>
                  )}
                </div>
                <ol className="mt-3 grid gap-2 text-sm">
                  {lista.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
                      <span className="w-14 tabular-nums text-muted">
                        {x.get("orden")}. {hora(x.get("horaProgramada"))}
                      </span>
                      <span className="min-w-0 flex-1">
                        {x.get("equipo")} <span className="text-muted">({x.get("track")})</span>
                        {x.get("duracionSeg") ? (
                          <span className="block text-xs text-muted">
                            Real: {hora(x.get("inicioReal"))}–{hora(x.get("finReal"))} · {Math.floor(x.get("duracionSeg") / 60)} min {x.get("duracionSeg") % 60} s
                          </span>
                        ) : null}
                      </span>
                      <BotonAccion accion={turno.bind(null, x.id)}>Poner en pantalla</BotonAccion>
                      <BotonAccion accion={mover.bind(null, x.id, -1)} etiquetaAccesible={`Subir a ${x.get("equipo")}`}>
                        ↑
                      </BotonAccion>
                      <BotonAccion accion={mover.bind(null, x.id, 1)} etiquetaAccesible={`Bajar a ${x.get("equipo")}`}>
                        ↓
                      </BotonAccion>
                    </li>
                  ))}
                  {lista.length === 0 && <li className="text-muted">Sin turnos todavía.</li>}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="avisos" className="mt-10 max-w-xl">
        <h2 id="avisos" className="text-xl font-semibold">
          Aviso en las pantallas
        </h2>
        <p className="mt-1 text-sm text-muted">Actual: {avisoActual ?? "ninguno"}. Déjalo vacío para retirarlo.</p>
        <div className="mt-3">
          <FormularioAccion accion={aviso} etiqueta="Publicar aviso">
            <CampoTexto id="aviso" name="aviso" etiqueta="Texto del aviso" opcional maxLength={200} />
          </FormularioAccion>
        </div>
      </section>
    </div>
  );
}
