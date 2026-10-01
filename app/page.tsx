import Link from "next/link";
import { EVENT, TRACKS, TRACK_CODES } from "@/config/event";

// Portada provisional de la Fase 1. La landing completa (hero con cuenta regresiva) es la Fase 2.
export default function Inicio() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="max-w-[18ch] text-4xl font-semibold sm:text-5xl">{EVENT.nombre}</h1>
      <p className="mt-4 max-w-prose text-lg text-muted">
        Viernes 6 y sábado 7 de noviembre de 2026 · {EVENT.sede.nombre}, {EVENT.sede.ciudad}.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        {TRACK_CODES.map((code) => (
          <li key={code} className="rounded border border-border bg-surface p-4">
            <p className="text-sm text-muted">{code}</p>
            <h2 className="mt-1 text-lg">{TRACKS[code].nombre}</h2>
          </li>
        ))}
      </ul>
      <Link
        href="/registro"
        className="mt-10 inline-block rounded bg-accent px-5 py-3 font-medium text-on-accent hover:brightness-95"
      >
        Inscribir a mi equipo
      </Link>
    </section>
  );
}
