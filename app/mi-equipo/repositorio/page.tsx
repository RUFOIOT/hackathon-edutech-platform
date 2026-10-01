import { redirect } from "next/navigation";
import type { Timestamp } from "firebase-admin/firestore";
import { EVENT, fecha } from "@/config/event";
import { requireSesion } from "@/lib/auth/session";
import { fechaEnEcuador } from "@/lib/event/countdown";
import { ahora } from "@/lib/event/reloj";
import { adminDb } from "@/lib/firebase/admin";
import type { Alerta, Chequeo, EstadoCheckpoint } from "@/lib/github";
import { BotonActualizar, FormRepositorio } from "./formulario";
import { ListaChequeos } from "./lista-chequeos";

export const metadata = { title: "Repositorio" };
export const dynamic = "force-dynamic";

const ESTADO: Record<EstadoCheckpoint, { texto: string; clase: string }> = {
  cumplido: { texto: "Cumplido", clase: "text-positive-text" },
  pendiente: { texto: "Pendiente", clase: "text-accent-text" },
  vencido: { texto: "Vencido", clase: "text-danger" },
};

const ARCHIVO_ETIQUETA: Record<string, string> = { "n8n/*.json": "n8n/*.json (si usan n8n)" };

interface SnapshotGuardado {
  tomadoEn: Timestamp;
  commitsEnVentana: number;
  autores: string[];
  ultimoCommitAt: Timestamp | null;
  archivosObligatorios: Record<string, boolean>;
  alertas: Alerta[];
  checkpoint1: EstadoCheckpoint;
  checkpoint2: EstadoCheckpoint;
}

export default async function Repositorio() {
  const id = await requireSesion("/mi-equipo/repositorio");
  if (!id.esParticipante) redirect("/registro");
  const p = await adminDb().doc(`participants/${id.uid}`).get();
  const teamId = p.get("teamId") as string | null;
  if (!teamId) redirect("/mi-equipo");
  const [team, repo] = await Promise.all([adminDb().doc(`teams/${teamId}`).get(), adminDb().doc(`repositories/${teamId}`).get()]);
  const esperado = `edutech26-${String(team.get("track")).toLowerCase()}-${team.get("slug")}`;
  const antesDelKickoff = ahora() < fecha("kickoff");
  const s = repo.get("ultimoSnapshot") as SnapshotGuardado | undefined;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Repositorio</h1>

      <ol className="mt-6 max-w-prose list-decimal space-y-1 pl-5 text-sm">
        <li>
          Entra a la organización <code className="font-mono">{EVENT.githubOrg}</code> con la invitación que recibiste por correo.
        </li>
        <li>
          Crea el repositorio desde la plantilla <code className="font-mono">{EVENT.repoPlantilla}</code> con el botón Use this template.
        </li>
        <li>
          Nómbralo <code className="font-mono">{esperado}</code>.
        </li>
        <li>Pega aquí su URL.</li>
      </ol>

      {antesDelKickoff ? (
        <p className="mt-8 rounded border border-accent bg-surface p-4">
          Los repositorios se crean y registran desde el kick-off: {fechaEnEcuador(fecha("kickoff"))}. Uno creado antes no se acepta.
        </p>
      ) : (
        <section aria-labelledby="registro-repo" className="mt-8">
          <h2 id="registro-repo" className="text-xl font-semibold">
            {repo.exists ? "Repositorio registrado" : "Registrar el repositorio"}
          </h2>
          <div className="mt-4">
            <FormRepositorio urlActual={repo.get("url") ?? ""} esperado={esperado} />
          </div>
          {repo.exists && (
            <div className="mt-6">
              <h3 className="font-semibold">Última validación</h3>
              <div className="mt-2">
                <ListaChequeos chequeos={(repo.get("chequeos") ?? []) as Chequeo[]} />
              </div>
            </div>
          )}
        </section>
      )}

      {s && (
        <section aria-labelledby="metricas" className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="metricas" className="text-xl font-semibold">
              Métricas leídas de GitHub
            </h2>
            <p className="text-sm text-muted">Actualizado: {fechaEnEcuador(s.tomadoEn.toDate())}</p>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded border border-border bg-surface p-4">
              <dt className="text-sm text-muted">Commits en la ventana</dt>
              <dd className="text-2xl font-semibold">{s.commitsEnVentana}</dd>
            </div>
            <div className="rounded border border-border bg-surface p-4">
              <dt className="text-sm text-muted">Autores</dt>
              <dd className="text-2xl font-semibold">{s.autores.length}</dd>
              <dd className="mt-1 font-mono text-xs">{s.autores.join(", ")}</dd>
            </div>
            <div className="rounded border border-border bg-surface p-4">
              <dt className="text-sm text-muted">Último commit</dt>
              <dd className="font-medium">{s.ultimoCommitAt ? fechaEnEcuador(s.ultimoCommitAt.toDate()) : "Sin commits aún"}</dd>
            </div>
          </dl>

          <h3 className="mt-8 font-semibold">Checkpoints</h3>
          <table className="mt-2 w-full max-w-xl text-left text-sm">
            <tbody>
              <tr className="border-b border-border">
                <th scope="row" className="py-2 pr-4 font-normal">
                  Checkpoint 1 · README con problema, usuario, evidencia y arquitectura (vie 19:00)
                </th>
                <td className={`py-2 font-semibold ${ESTADO[s.checkpoint1].clase}`}>{ESTADO[s.checkpoint1].texto}</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="py-2 pr-4 font-normal">
                  Checkpoint 2 · demo mínima ejecutable (sáb 10:30)
                </th>
                <td className={`py-2 font-semibold ${ESTADO[s.checkpoint2].clase}`}>
                  {ESTADO[s.checkpoint2].texto}
                  <span className="block text-xs font-normal text-muted">La mesa técnica lo confirma</span>
                </td>
              </tr>
            </tbody>
          </table>

          <h3 className="mt-8 font-semibold">Archivos obligatorios</h3>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {Object.entries(s.archivosObligatorios).map(([archivo, ok]) => (
              <li key={archivo} className="flex gap-2">
                <span className={`font-semibold ${ok ? "text-positive-text" : "text-danger"}`}>{ok ? "Está" : "Falta"}</span>
                <code className="font-mono">{ARCHIVO_ETIQUETA[archivo] ?? archivo}</code>
              </li>
            ))}
          </ul>

          {s.alertas.length > 0 && (
            <>
              <h3 className="mt-8 font-semibold">Alertas</h3>
              <ul className="mt-2 grid gap-2 text-sm">
                {s.alertas.map((a, i) => (
                  <li key={i} className={`rounded border p-3 ${a.nivel === "roja" ? "border-danger" : "border-accent"}`}>
                    <span className="font-semibold">{a.nivel === "roja" ? "Atención inmediata: " : "Revisa: "}</span>
                    {a.detalle}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted">Si una alerta es de una clave expuesta, rótala de inmediato y avisa a la mesa técnica.</p>
            </>
          )}
          <div className="mt-6">
            <BotonActualizar />
          </div>
        </section>
      )}
    </div>
  );
}
