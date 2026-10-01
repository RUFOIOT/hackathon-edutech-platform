import type { Metadata } from "next";
import Link from "next/link";
import { PREMIO_TRANSVERSAL, TRACKS, TRACK_CODES } from "@/config/event";

export const metadata: Metadata = { title: "Tracks", description: "Los tres tracks del hackathon, sus preguntas guía y retos de ejemplo." };

export default function Tracks() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Tracks</h1>
      <p className="mt-3 max-w-prose text-muted">
        Cada equipo compite en un solo track. Puedes cambiarlo hasta el checkpoint 1, el viernes a las 19:00. Los ejemplos
        son puntos de partida, no una lista cerrada.
      </p>

      <div className="mt-10 grid gap-12">
        {TRACK_CODES.map((code) => (
          <section key={code} aria-labelledby={`track-${code}`} className="grid gap-6 border-t border-border pt-8 lg:grid-cols-2">
            <div>
              <p className="text-sm text-muted">{code}</p>
              <h2 id={`track-${code}`} className="mt-1 text-2xl font-semibold">
                {TRACKS[code].nombre}
              </h2>
              <p className="mt-4 max-w-prose font-display text-lg">{TRACKS[code].pregunta}</p>
              {code === "T3" && (
                <p className="mt-4 max-w-prose text-sm text-muted">
                  En este track, el criterio de viabilidad e impacto exige estimar el ahorro de tiempo o dinero del proceso
                  automatizado.
                </p>
              )}
            </div>
            <div>
              <h3 className="font-semibold">Retos de ejemplo</h3>
              <ul className="mt-3 grid gap-2">
                {TRACKS[code].ejemplos.map((e) => (
                  <li key={e} className="rounded border border-border bg-surface px-4 py-2">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}

        <section aria-labelledby="premio-n8n" className="rounded border-2 border-accent bg-surface p-6">
          <h2 id="premio-n8n" className="text-2xl font-semibold">
            {PREMIO_TRANSVERSAL}
          </h2>
          <p className="mt-3 max-w-prose">
            Transversal a los tres tracks. Lo gana el mayor puntaje en el criterio C4 (automatización e inteligencia) entre
            los equipos que tengan sus workflows de n8n exportados en la carpeta <code className="font-mono">/n8n</code>{" "}
            del repositorio. En caso de empate, decide el representante de n8n.
          </p>
          <p className="mt-4 text-sm">
            <Link href={`/rubrica#${ANCLA_C4}`} className="font-medium text-positive-text underline underline-offset-4">
              Ver cómo se evalúa C4
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

const ANCLA_C4 = "c4--automatización-e-inteligencia-15-";
