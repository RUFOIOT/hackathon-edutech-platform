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
        {ctx.team.get("track")} · {ctx.team.get("categoria") === "JUNIOR" ? "Junior" : "Open"} · Show and Tell
      </p>

      <EnlacesEquipo
        repoUrl={repo.get("url")}
        tagSha={sub.get("tagSha")}
        demoUrl={sub.get("demoUrl")}
        videoUrl={sub.get("videoUrl")}
      />

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
          <p className="rounded border border-border bg-surface p-4">
            Conflicto declarado: no evalúas a este equipo y tu ausencia no afecta su promedio.{" "}
            <Link href="/jurado" className="underline">
              Volver a la lista
            </Link>
          </p>
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

/** Solo enlaces http(s): los valores vienen del formulario de entrega y del registro del repo. */
function urlSegura(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Repositorio, código entregado y demo del equipo, para revisar antes o durante su turno. */
function EnlacesEquipo({ repoUrl, tagSha, demoUrl, videoUrl }: { repoUrl: unknown; tagSha: unknown; demoUrl: unknown; videoUrl: unknown }) {
  const repo = urlSegura(repoUrl);
  const demo = urlSegura(demoUrl);
  const video = urlSegura(videoUrl);
  const sha = typeof tagSha === "string" && /^[0-9a-f]{7,40}$/i.test(tagSha) ? tagSha : null;
  const enlace = "font-medium text-accent-text underline underline-offset-2 break-all";
  return (
    <div className="mt-6 rounded border border-border bg-surface p-4">
      <h2 className="font-medium">Repositorio y demo</h2>
      <dl className="mt-3 grid gap-3 text-sm">
        <div>
          <dt className="text-muted">Repositorio</dt>
          <dd>
            {repo ? (
              <a href={repo} target="_blank" rel="noopener noreferrer" className={enlace}>
                {repo.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              "El equipo aún no registra su repositorio."
            )}
          </dd>
        </div>
        {repo && sha && (
          <div>
            <dt className="text-muted">Código entregado (tag entrega)</dt>
            <dd>
              <a href={`${repo.replace(/\/$/, "")}/tree/${sha}`} target="_blank" rel="noopener noreferrer" className={enlace}>
                Ver el código en el commit {sha.slice(0, 7)}
              </a>
            </dd>
          </div>
        )}
        <div>
          <dt className="text-muted">Demo</dt>
          <dd>
            {demo ? (
              <a href={demo} target="_blank" rel="noopener noreferrer" className={enlace}>
                {demo.replace(/^https?:\/\//, "")}
              </a>
            ) : demoUrl === "ejecucion-local" ? (
              "Ejecución local: el README del repositorio explica cómo correrla."
            ) : (
              "Aún no envían el formulario de entrega."
            )}
          </dd>
        </div>
        {video && (
          <div>
            <dt className="text-muted">Video de respaldo</dt>
            <dd>
              <a href={video} target="_blank" rel="noopener noreferrer" className={enlace}>
                {video.replace(/^https?:\/\//, "")}
              </a>
              <span className="block text-xs text-muted">Solo vale si falla la conectividad de la sede, y el jurado lo registra.</span>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
