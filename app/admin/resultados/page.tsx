import { EVENT, PREMIO } from "@/config/event";
import { FormularioAccion } from "@/components/admin/accion";
import { CampoSelect } from "@/components/formulario";
import { requireAdmin } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { propuestaResultados } from "@/lib/jurado/servicio";
import type { RankingGeneral } from "@/lib/scoring";
import { publicar } from "./acciones";

export const metadata = { title: "Resultados" };
export const dynamic = "force-dynamic";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default async function AdminResultados() {
  await requireAdmin("/admin/resultados");
  const db = adminDb();
  const [datos, evento] = await Promise.all([propuestaResultados(), db.doc(`events/${EVENT.id}`).get()]);
  const publicado = evento.get("resultadosPublicados") === true;
  const nombre = (t: string) => datos.nombres[t] ?? t;
  const faltantes = datos.progreso.filter((p) => p.registradas < p.esperadas);
  const { propuesta } = datos;
  const opciones = (r: RankingGeneral) => r.orden.map((e) => ({ valor: e.teamId, etiqueta: `${nombre(e.teamId)} · z ${e.z ?? "sin normalizar"} · ${e.puntaje}/100` }));

  const tablaRanking = (titulo: string, id: string, r: RankingGeneral) => (
    <section aria-labelledby={id} className="mt-8">
      <h3 id={id} className="text-lg font-semibold">
        {titulo}
      </h3>
      {r.orden.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Aún no hay equipos evaluados en esta categoría.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3">Posición</th>
                <th scope="col" className="py-2 pr-3">Equipo</th>
                <th scope="col" className="py-2 pr-3">Track</th>
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
              {r.orden.map((e, i) => {
                const empatado = r.empatesSinResolver.some(([a, b]) => a === e.teamId || b === e.teamId);
                return (
                  <tr key={e.teamId} className="border-b border-border">
                    <td className="py-2 pr-3 tabular-nums">{i + 1}</td>
                    <td className="py-2 pr-3">
                      {nombre(e.teamId)}
                      {empatado && <span className="block text-xs font-medium text-danger">Empate total: decide la deliberación del jurado</span>}
                    </td>
                    <td className="py-2 pr-3">{datos.tracks[e.teamId] ?? "—"}</td>
                    <td className="py-2 pr-3">{e.roomId}</td>
                    <td className="py-2 pr-3 tabular-nums">{e.jueces}</td>
                    <td className="py-2 pr-3 tabular-nums">{e.puntaje}</td>
                    <td className="py-2 pr-3 tabular-nums">{e.z ?? "sin normalizar"}</td>
                    <td className="py-2 pr-3 tabular-nums">{e.promedioC2}</td>
                    <td className="py-2 pr-3 tabular-nums">{e.promedioC1}</td>
                    <td className="py-2 tabular-nums">{mmss(e.tiempoPromedioSeg)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Resultados</h1>
      <p className="mt-1 text-sm text-muted">
        Visible solo para admin y comité. {publicado ? "Los resultados ya están publicados." : "Aún no publicados."} Los resultados deben estar listos a
        las 16:30 para la premiación de las 16:45.
      </p>

      <section aria-labelledby="salas" className="mt-8">
        <h2 id="salas" className="text-xl font-semibold">
          Show and Tell · normalización por sala
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
              {datos.salas.map((s) => (
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
        {propuesta.rankingOpen.requiereDecisionComite && (
          <p className="mt-3 text-sm">
            Hay salas sin normalizar ({propuesta.rankingOpen.salasSinNormalizar.join(", ")}): sus equipos aparecen al final del ranking ordenados por
            puntaje y el comité decide su ubicación (rúbrica §5).
          </p>
        )}
        <p className="mt-3 text-sm text-muted">
          Ranking por z de cada sala. Desempate: C2, C1, menor tiempo; si persiste, decide la deliberación del jurado y el comité elige al ganador abajo.
        </p>
        {tablaRanking("Categoría Open", "rank-open", propuesta.rankingOpen)}
        {tablaRanking("Categoría Junior", "rank-junior", propuesta.rankingJunior)}
      </section>

      <section aria-labelledby="premios" className="mt-12">
        <h2 id="premios" className="text-xl font-semibold">
          Premios
        </h2>
        <p className="mt-1 text-sm text-muted">Vienen elegidos según el ranking. El comité puede cambiarlos (empates, salas sin normalizar) antes de publicar.</p>
        <FormularioAccion accion={publicar} etiqueta="Publicar resultados" className="mt-4 grid max-w-xl gap-5">
          <CampoSelect id="primeroOpen" etiqueta={PREMIO.primeroOpen} opcional defaultValue={propuesta.primeroOpen ?? ""} opciones={opciones(propuesta.rankingOpen)} />
          <CampoSelect id="segundoOpen" etiqueta={PREMIO.segundoOpen} opcional defaultValue={propuesta.segundoOpen ?? ""} opciones={opciones(propuesta.rankingOpen)} />
          <CampoSelect id="mejorJunior" etiqueta={PREMIO.mejorJunior} opcional defaultValue={propuesta.mejorJunior ?? ""} opciones={opciones(propuesta.rankingJunior)} />
          <p className="text-sm text-muted">Todos los participantes reciben un certificado digital de participación con la retroalimentación del jurado.</p>
          <label className="flex items-start gap-2 font-medium">
            <input type="checkbox" name="revisado" className="mt-1 accent-navy-700" />
            Confirmo que el comité revisó el ranking, los desempates y los premios.
          </label>
        </FormularioAccion>
      </section>
    </div>
  );
}
