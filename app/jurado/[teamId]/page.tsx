import Link from "next/link";
import type { Timestamp } from "firebase-admin/firestore";
import { requireJuez } from "@/lib/auth/session";
import { fechaEnEcuador } from "@/lib/event/countdown";
import { adminDb } from "@/lib/firebase/admin";
import type { Alerta } from "@/lib/github";
import { contextoEvaluacion, type ContextoEvaluacion } from "@/lib/jurado/servicio";
import { ErrorRegistro } from "@/lib/registro/servicio";
import { HojaEvaluacion } from "./hoja";

export const metadata = { title: "Hoja de evaluación" };
export const dynamic = "force-dynamic";

interface SnapshotJurado {
  commitsEnVentana: number;
  autores: string[];
  ultimoCommitAt: Timestamp | null;
  archivosObligatorios: Record<string, boolean>;
  alertas: Alerta[];
}

export default async function Evaluacion({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const id = await requireJuez(`/jurado/${teamId}`);
  let ctx: ContextoEvaluacion;
  try {
    ctx = await contextoEvaluacion(id.uid, teamId);
  } catch (err) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-8">
        <p role="alert" className="text-danger">
          {err instanceof ErrorRegistro ? err.message : "No pudimos cargar la hoja de evaluación."}
        </p>
        <Link href="/jurado" className="mt-4 inline-block underline">
          Volver a la lista
        </Link>
      </section>
    );
  }
  const [repo, sub] = await Promise.all([adminDb().doc(`repositories/${teamId}`).get(), adminDb().doc(`submissions/${teamId}`).get()]);
  const s = repo.get("ultimoSnapshot") as SnapshotJurado | undefined;
  const p = ctx.puntaje;

  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/jurado" className="text-sm underline">
        ← Equipos de mi sala
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">{ctx.team.get("nombre")}</h1>
      <p className="text-muted">
        {ctx.team.get("track")} · {ctx.ronda === "final" ? "Final" : "Semifinal"}
      </p>

      <details className="mt-6 rounded border border-border bg-surface p-4">
        <summary className="cursor-pointer font-medium">Métricas del repositorio (solo lectura)</summary>
        {s ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Commits en la ventana</dt>
              <dd className="font-semibold">{s.commitsEnVentana}</dd>
            </div>
            <div>
              <dt className="text-muted">Autores</dt>
              <dd className="font-semibold">{s.autores.length}</dd>
            </div>
            <div>
              <dt className="text-muted">Último commit</dt>
              <dd>{s.ultimoCommitAt ? fechaEnEcuador(s.ultimoCommitAt.toDate()) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">.env.example</dt>
              <dd>{s.archivosObligatorios[".env.example"] ? "Presente" : "Falta"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">Alertas de secretos</dt>
              <dd>{s.alertas.filter((a) => a.tipo === "secreto" || a.tipo === "env-versionado").length || "Ninguna"}</dd>
            </div>
            {sub.get("tagSha") && (
              <div className="col-span-2">
                <dt className="text-muted">Commit entregado (tag entrega)</dt>
                <dd className="break-all font-mono text-xs">{sub.get("tagSha")}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted">Sin datos del repositorio.</p>
        )}
        <p className="mt-3 text-xs text-muted">Insumo para C3; no puntúa por sí solo (rúbrica §3).</p>
      </details>

      {ctx.salaCerrada && (
        <p className="mt-6 rounded border border-accent bg-surface p-3 text-sm">
          La sala está cerrada: los puntajes están bloqueados. Solo el comité puede reabrirla.
        </p>
      )}

      <div className="mt-6">
        {ctx.conflicto ? (
          <p className="rounded border border-border bg-surface p-4">Declaraste conflicto de interés con este equipo: no lo evalúas.</p>
        ) : (
          <HojaEvaluacion
            teamId={teamId}
            bloqueada={ctx.salaCerrada}
            previo={
              p
                ? {
                    c1: p.get("c1"),
                    c2: p.get("c2"),
                    c3: p.get("c3"),
                    c4: p.get("c4"),
                    c5: p.get("c5"),
                    c6: p.get("c6"),
                    tiempoUsadoSeg: p.get("tiempoUsadoSeg"),
                    demoEnVivo: p.get("demoEnVivo"),
                    fortaleza: p.get("fortaleza"),
                    recomendacion: p.get("recomendacion"),
                  }
                : null
            }
          />
        )}
      </div>
    </section>
  );
}
