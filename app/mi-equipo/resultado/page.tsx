import { redirect } from "next/navigation";
import { requireSesion } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";

export const metadata = { title: "Nuestro resultado" };
export const dynamic = "force-dynamic";

/** Puntaje, fortalezas y recomendaciones del jurado, una vez publicados (sin identificar al juez). */
export default async function Resultado() {
  const id = await requireSesion("/mi-equipo/resultado");
  if (!id.esParticipante) redirect("/registro");
  const p = await adminDb().doc(`participants/${id.uid}`).get();
  const teamId = p.get("teamId") as string | null;
  if (!teamId) redirect("/mi-equipo");
  const r = await adminDb().doc(`results/${teamId}`).get();

  if (!r.exists || r.get("publicado") !== true) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold">Nuestro resultado</h1>
        <p className="mt-4 text-muted">El resultado y la retroalimentación del jurado aparecerán aquí cuando el comité los publique.</p>
      </section>
    );
  }
  const premios = (r.get("premios") ?? []) as string[];
  const fortalezas = (r.get("fortalezas") ?? []) as string[];
  const recomendaciones = (r.get("recomendaciones") ?? []) as string[];

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Nuestro resultado</h1>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-border bg-surface p-4">
          <dt className="text-sm text-muted">Puntaje en la semifinal</dt>
          <dd className="text-3xl font-semibold tabular-nums">{r.get("puntajeSemifinal")}/100</dd>
        </div>
        {r.get("finalista") && (
          <div className="rounded border border-accent bg-surface p-4">
            <dt className="text-sm text-muted">Final</dt>
            <dd className="text-3xl font-semibold tabular-nums">{r.get("posicionFinal")}.º lugar</dd>
            <dd className="text-sm">{r.get("puntajeFinal")}/100</dd>
          </div>
        )}
        {premios.length > 0 && (
          <div className="rounded border border-accent bg-surface p-4">
            <dt className="text-sm text-muted">Premios</dt>
            {premios.map((x) => (
              <dd key={x} className="font-medium">
                {x}
              </dd>
            ))}
          </div>
        )}
      </dl>
      <h2 className="mt-10 text-xl font-semibold">Fortalezas que destacó el jurado</h2>
      <ul className="mt-3 grid gap-2">
        {fortalezas.map((f, i) => (
          <li key={i} className="rounded border border-border bg-surface p-3">
            {f}
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-xl font-semibold">Recomendaciones</h2>
      <ul className="mt-3 grid gap-2">
        {recomendaciones.map((f, i) => (
          <li key={i} className="rounded border border-border bg-surface p-3">
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
}
