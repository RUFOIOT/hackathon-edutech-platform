import { EVENT } from "@/config/event";
import { FormularioAccion } from "@/components/admin/accion";
import { claseInput } from "@/components/formulario";
import { requireAdmin } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { cargarRonda, propuestaSemifinal, rondaActiva } from "@/lib/jurado/servicio";
import { calcularPremios, rankingFinal } from "@/lib/scoring";
import { finalistas, publicar } from "./acciones";

export const metadata = { title: "Resultados" };
export const dynamic = "force-dynamic";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default async function AdminResultados() {
  await requireAdmin("/admin/resultados");
  const db = adminDb();
  const [semi, ronda, evento] = await Promise.all([propuestaSemifinal(), rondaActiva(), db.doc(`events/${EVENT.id}`).get()]);
  const publicado = evento.get("resultadosPublicados") === true;
  const ordenSemi = [...semi.equipos].sort((a, b) => (b.z ?? -Infinity) - (a.z ?? -Infinity) || b.puntaje - a.puntaje);
  const nombre = (t: string) => semi.nombres[t] ?? t;

  let ranking: ReturnType<typeof rankingFinal> | null = null;
  let premiosPrevios: ReturnType<typeof calcularPremios> | null = null;
  if (ronda === "final") {
    const final = await cargarRonda("final");
    ranking = rankingFinal(final.resultados);
    const [equipos, repos] = await Promise.all([db.collection("teams").get(), db.collection("repositories").get()]);
    premiosPrevios = calcularPremios({
      ordenFinal: ranking.orden.map((r) => r.teamId),
      semifinal: semi.resultados,
      track: semi.tracks,
      tieneN8n: Object.fromEntries(repos.docs.map((r) => [r.id, (r.get("ultimoSnapshot")?.archivosObligatorios?.["n8n/*.json"] ?? false) === true])),
      esJunior: Object.fromEntries(equipos.docs.map((e) => [e.id, e.get("categoria") === "JUNIOR"])),
    });
  }
  const faltantes = semi.progreso.filter((p) => p.registradas < p.esperadas);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Resultados</h1>
      <p className="mt-1 text-sm text-muted">
        Visible solo para admin y comité. {publicado ? "Los resultados ya están publicados." : "Aún no publicados."}
      </p>

      <section aria-labelledby="semi" className="mt-8">
        <h2 id="semi" className="text-xl font-semibold">
          Semifinal · normalización por sala
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full max-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-4">Sala</th>
                <th scope="col" className="py-2 pr-4">Equipos</th>
                <th scope="col" className="py-2 pr-4">Promedio</th>
                <th scope="col" className="py-2 pr-4">Desviación</th>
                <th scope="col" className="py-2">Normalización</th>
              </tr>
            </thead>
            <tbody>
              {semi.salas.map((s) => (
                <tr key={s.roomId} className="border-b border-border">
                  <td className="py-2 pr-4">{s.roomId}</td>
                  <td className="py-2 pr-4 tabular-nums">{s.equipos}</td>
                  <td className="py-2 pr-4 tabular-nums">{s.promedio}</td>
                  <td className="py-2 pr-4 tabular-nums">{s.desviacion}</td>
                  <td className={`py-2 font-medium ${s.sinNormalizar ? "text-accent-text" : "text-positive-text"}`}>
                    {s.sinNormalizar ? "Sin normalizar (menos de 4 equipos): decide el comité" : "Normalizada"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {faltantes.length > 0 && (
          <p className="mt-3 rounded border border-accent bg-surface p-3 text-sm">
            Faltan evaluaciones en: {faltantes.map((p) => `${p.roomId} (${p.registradas}/${p.esperadas})`).join(", ")}.
          </p>
        )}

        {(() => {
          const tabla = (<>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-3">Finalista</th>
                  <th scope="col" className="py-2 pr-3">Equipo</th>
                  <th scope="col" className="py-2 pr-3">Sala</th>
                  <th scope="col" className="py-2 pr-3">Jueces</th>
                  <th scope="col" className="py-2 pr-3">Puntaje</th>
                  <th scope="col" className="py-2 pr-3">z</th>
                  <th scope="col" className="py-2 pr-3">C2</th>
                  <th scope="col" className="py-2 pr-3">C1</th>
                  <th scope="col" className="py-2">Tiempo</th>
                </tr>
              </thead>
              <tbody>
                {ordenSemi.map((e) => (
                  <tr key={e.teamId} className="border-b border-border">
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        name="finalista"
                        value={e.teamId}
                        defaultChecked={semi.propuesta.finalistas.includes(e.teamId)}
                        aria-label={`Finalista: ${nombre(e.teamId)}`}
                        disabled={ronda === "final"}
                        className="accent-navy-700"
                      />
                    </td>
                    <td className="py-2 pr-3">{nombre(e.teamId)}</td>
                    <td className="py-2 pr-3">{e.roomId}</td>
                    <td className="py-2 pr-3 tabular-nums">{e.jueces}</td>
                    <td className="py-2 pr-3 tabular-nums">{e.puntaje}</td>
                    <td className="py-2 pr-3 tabular-nums">{e.z ?? "sin normalizar"}</td>
                    <td className="py-2 pr-3 tabular-nums">{e.promedioC2}</td>
                    <td className="py-2 pr-3 tabular-nums">{e.promedioC1}</td>
                    <td className="py-2 tabular-nums">{mmss(e.tiempoPromedioSeg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {semi.propuesta.requiereDecisionComite && (
            <p className="text-sm">
              Hay salas sin normalizar ({semi.propuesta.salasSinNormalizar.join(", ")}): la propuesta solo marca los 5 mejores z de las salas
              normalizadas; el comité decide los cupos de las demás (rúbrica §5).
            </p>
          )}
          {semi.propuesta.empatesSinResolver.length > 0 && (
            <p className="text-sm text-danger">
              Empate sin resolver en el corte: {semi.propuesta.empatesSinResolver.map(([a, b]) => `${nombre(a)} y ${nombre(b)}`).join("; ")}.
            </p>
          )}
          {ronda === "final" && <p className="text-sm text-muted">La final ya está abierta: los finalistas no se pueden cambiar desde aquí.</p>}
</>);
          // Con la final abierta, la tabla queda como consulta: los finalistas ya no se cambian aquí.
          return ronda === "final" ? (
            <div className="mt-6 grid gap-4">{tabla}</div>
          ) : (
            <FormularioAccion accion={finalistas} etiqueta="Confirmar finalistas y abrir la final" className="mt-6 grid gap-4">
              {tabla}
            </FormularioAccion>
          );
        })()}
      </section>

      {ranking && premiosPrevios && (
        <section aria-labelledby="fin" className="mt-12">
          <h2 id="fin" className="text-xl font-semibold">
            Final · ranking y premios
          </h2>
          <p className="mt-1 text-sm text-muted">
            Puntajes desde cero (no se arrastran los de la semifinal). Desempate: C2, C1, menor tiempo; si persiste, vota el jurado de la final y el
            comité fija la posición.
          </p>
          <FormularioAccion accion={publicar} etiqueta="Publicar resultados" className="mt-4 grid gap-6">
            <div className="overflow-x-auto">
              <table className="w-full max-w-4xl text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-3">Posición</th>
                    <th scope="col" className="py-2 pr-3">Equipo</th>
                    <th scope="col" className="py-2 pr-3">Puntaje final</th>
                    <th scope="col" className="py-2 pr-3">C2</th>
                    <th scope="col" className="py-2 pr-3">C1</th>
                    <th scope="col" className="py-2">Tiempo</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.orden.map((r, i) => {
                    const empatado = ranking.empatesSinResolver.some(([a, b]) => a === r.teamId || b === r.teamId);
                    return (
                      <tr key={r.teamId} className="border-b border-border">
                        <td className="py-2 pr-3">
                          <label htmlFor={`pos-${r.teamId}`} className="sr-only">
                            Posición de {nombre(r.teamId)}
                          </label>
                          <input
                            id={`pos-${r.teamId}`}
                            name={`pos_${r.teamId}`}
                            type="number"
                            min={1}
                            max={ranking.orden.length}
                            defaultValue={i + 1}
                            className={`${claseInput} w-16 py-1`}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          {nombre(r.teamId)}
                          {empatado && <span className="block text-xs font-medium text-danger">Empate total: decide la votación del jurado</span>}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{r.puntaje}</td>
                        <td className="py-2 pr-3 tabular-nums">{r.promedioC2}</td>
                        <td className="py-2 pr-3 tabular-nums">{r.promedioC1}</td>
                        <td className="py-2 tabular-nums">{mmss(r.tiempoPromedioSeg)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="font-semibold">Premios (vista previa con el orden calculado)</h3>
              <ul className="mt-2 grid gap-1 text-sm">
                {premiosPrevios.premios.map((p) => (
                  <li key={p.premio}>
                    <span className="font-medium">{p.premio}:</span> {p.teamId ? nombre(p.teamId) : "Sin ganador elegible: decide el comité"}
                    {p.nota && <span className="text-muted"> · {p.nota}</span>}
                  </li>
                ))}
              </ul>
            </div>

            <fieldset>
              <legend className="font-semibold">Pase a la Aceleradora (hasta 3, entre el top 10, priorizando C1 y C5)</legend>
              <div className="mt-2 grid gap-1 text-sm">
                {premiosPrevios.candidatosAceleradora.map((t) => (
                  <label key={t} className="flex items-center gap-2">
                    <input type="checkbox" name="aceleradora" value={t} className="accent-navy-700" /> {nombre(t)}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-start gap-2 font-medium">
              <input type="checkbox" name="revisado" className="mt-1 accent-navy-700" />
              Confirmo que el comité revisó el ranking, los desempates y los premios.
            </label>
          </FormularioAccion>
        </section>
      )}
    </div>
  );
}
