import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase/admin";

export const metadata: Metadata = { title: "Resultados", description: "Ganadores de la Hackathon EduTech." };
export const dynamic = "force-dynamic";

interface Publicados {
  publicado: boolean;
  premios: { premio: string; equipo: string; track?: string | null }[];
}

/** Visible solo cuando el comité publica (prompt §4). */
export default async function Resultados() {
  const snap = await adminDb().doc("public_state/resultados").get();
  const datos = snap.exists ? (snap.data() as Publicados) : null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Resultados</h1>
      {!datos?.publicado ? (
        <p className="mt-4 text-muted">Los resultados se publicarán al cierre del evento, el sábado 28 de noviembre.</p>
      ) : (
        <>
          <h2 className="mt-10 text-2xl font-semibold">Ganadores</h2>
          <dl className="mt-4 grid gap-3">
            {datos.premios.map((p) => (
              <div key={`${p.premio}-${p.equipo}`} className="grid gap-1 rounded border border-accent bg-surface p-4 sm:grid-cols-2">
                <dt className="text-muted">{p.premio}</dt>
                <dd className="font-medium">
                  {p.equipo}
                  {p.track && <span className="ml-2 text-sm font-normal text-muted">{p.track}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-muted">Todos los participantes reciben un certificado digital con la retroalimentación del jurado.</p>
        </>
      )}
    </section>
  );
}
