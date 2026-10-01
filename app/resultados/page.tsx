import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase/admin";

export const metadata: Metadata = { title: "Resultados", description: "Ranking final y premios de la Hackathon EduTech." };
export const dynamic = "force-dynamic";

interface Publicados {
  publicado: boolean;
  ranking: { posicion: number; equipo: string; track: string | null }[];
  premios: { premio: string; equipo: string }[];
}

/** Visible solo cuando el comité publica (prompt §4). */
export default async function Resultados() {
  const snap = await adminDb().doc("public_state/resultados").get();
  const datos = snap.exists ? (snap.data() as Publicados) : null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Resultados</h1>
      {!datos?.publicado ? (
        <p className="mt-4 text-muted">Los resultados se publicarán al cierre del evento, el sábado 7 de noviembre.</p>
      ) : (
        <>
          <h2 className="mt-10 text-2xl font-semibold">Ranking de la final</h2>
          <ol className="mt-4 grid gap-2">
            {datos.ranking.map((r) => (
              <li key={r.posicion} className={`flex items-baseline gap-4 rounded border p-4 ${r.posicion <= 3 ? "border-accent bg-surface" : "border-border"}`}>
                <span className="w-10 font-display text-2xl font-semibold tabular-nums">{r.posicion}.</span>
                <span className="flex-1 font-medium">{r.equipo}</span>
                {r.track && <span className="text-sm text-muted">{r.track}</span>}
              </li>
            ))}
          </ol>
          <h2 className="mt-10 text-2xl font-semibold">Premios</h2>
          <dl className="mt-4 grid gap-3">
            {datos.premios.map((p) => (
              <div key={`${p.premio}-${p.equipo}`} className="grid gap-1 border-b border-border pb-3 sm:grid-cols-2">
                <dt className="text-muted">{p.premio}</dt>
                <dd className="font-medium">{p.equipo}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
