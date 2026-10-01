import Link from "next/link";
import { AGENDA, ALIADOS, EVENT, FAQ, PREMIOS, PREMIO_TRANSVERSAL, TRACKS, TRACK_CODES, fecha, mostrar } from "@/config/event";
import { HeroInfinito } from "@/components/hero-infinito";
import { diaEnEcuador, fechaEnEcuador } from "@/lib/event/countdown";
import { faseActual, inscripcionesAbiertas } from "@/lib/event/phase";
import { ahora } from "@/lib/event/reloj";

// Se regenera cada 5 minutos: el estado de las inscripciones depende de la fecha.
export const revalidate = 300;

const boton = "inline-block rounded bg-accent px-5 py-3 font-medium text-on-accent hover:brightness-95";
const enlace = "font-medium text-positive-text underline underline-offset-4";

function EstadoInscripciones() {
  const t = ahora();
  if (inscripcionesAbiertas(t)) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link href="/registro" className={boton}>
          Inscribir a mi equipo
        </Link>
        <Link href="/registro?modo=individual" className={enlace}>
          Inscribirme y buscar equipo
        </Link>
      </div>
    );
  }
  const apertura = EVENT.fechas.aperturaInscripciones;
  if (faseActual(t) === "Convocatoria") {
    return (
      <p className="text-center">
        Las inscripciones abren el <strong>{diaEnEcuador(fecha("aperturaInscripciones"))}</strong>
        {apertura.confirmada ? "." : " (fecha por confirmar)."}{" "}
        <Link href="/guia-hacker" className={enlace}>
          Prepárate con la Guía del hacker
        </Link>
      </p>
    );
  }
  return <p className="text-center">Las inscripciones están cerradas.</p>;
}

export default function Inicio() {
  const dias = ["Viernes 6", "Sábado 7"] as const;
  return (
    <>
      <section aria-labelledby="titulo" className="mx-auto max-w-6xl px-4 pt-12 pb-16 text-center sm:pt-16">
        <h1 id="titulo" className="mx-auto max-w-[20ch] text-3xl font-semibold sm:text-5xl">
          {EVENT.nombre}
        </h1>
        <p className="mx-auto mt-4 max-w-prose text-muted sm:text-lg">
          Viernes 6 y sábado 7 de noviembre de 2026 · {EVENT.sede.nombre}, {EVENT.sede.ciudad}
        </p>
        <div className="mt-10">
          <HeroInfinito objetivoIso={EVENT.fechas.kickoff.iso} etiquetaObjetivo={fechaEnEcuador(fecha("kickoff"))} />
        </div>
        <div className="mt-10">
          <EstadoInscripciones />
        </div>
      </section>

      <section aria-labelledby="que-es" className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_22rem]">
          <div>
            <h2 id="que-es" className="text-2xl font-semibold sm:text-3xl">
              Construye en vivo lo que la educación necesita
            </h2>
            <p className="mt-4 max-w-prose">
              Estudiantes, universitarios y profesionales construyen soluciones tecnológicas funcionales para los problemas
              reales de la educación: cómo aprende un estudiante, cómo funciona una institución y cómo se sostiene
              económicamente.
            </p>
            <p className="mt-6 max-w-prose border-l-4 border-accent pl-4 font-display text-lg">
              Se premia lo que funciona en vivo y está en el repositorio, no lo que se promete en una diapositiva.
            </p>
          </div>
          <dl className="grid content-start gap-4 text-sm">
            <div>
              <dt className="text-muted">Ventana de hacking</dt>
              <dd className="font-medium">Viernes 15:30 a sábado 12:00 (code freeze)</dd>
            </div>
            <div>
              <dt className="text-muted">Equipos</dt>
              <dd className="font-medium">De 2 a 5 personas; puedes inscribirte solo y te asignamos equipo</dd>
            </div>
            <div>
              <dt className="text-muted">Categorías</dt>
              <dd className="font-medium">Junior (14 a 17 años, con autorización del representante) y Open (18+)</dd>
            </div>
            <div>
              <dt className="text-muted">Show and Tell</dt>
              <dd className="font-medium">12 minutos por equipo: 8 de exposición y demo, 4 de preguntas</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="tracks" className="mx-auto max-w-6xl px-4 py-16">
        <h2 id="tracks" className="text-2xl font-semibold sm:text-3xl">
          Tres tracks, un premio transversal
        </h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {TRACK_CODES.map((code) => (
            <li key={code} className="flex flex-col rounded border border-border bg-surface p-5">
              <p className="text-sm text-muted">{code}</p>
              <h3 className="mt-1 text-lg font-semibold">{TRACKS[code].nombre}</h3>
              <p className="mt-3 text-sm">{TRACKS[code].pregunta}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-prose">
          <strong>{PREMIO_TRANSVERSAL}:</strong> la mejor automatización construida con n8n, en cualquier track.{" "}
          <Link href="/tracks" className={enlace}>
            Ver retos de ejemplo
          </Link>
        </p>
      </section>

      <section aria-labelledby="agenda" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="agenda" className="text-2xl font-semibold sm:text-3xl">
            Agenda
          </h2>
          <p className="mt-2 text-sm text-muted">Hora de Ecuador (UTC-5).</p>
          <div className="mt-8 grid gap-10 md:grid-cols-2">
            {dias.map((dia) => (
              <div key={dia}>
                <h3 className="text-lg font-semibold">{dia} de noviembre</h3>
                <ol className="mt-4 grid gap-3">
                  {AGENDA.filter((a) => a.dia === dia).map((a) => (
                    <li
                      key={`${a.hora}-${a.bloque}`}
                      className={`grid grid-cols-[3.5rem_1fr] gap-3 ${a.hito ? "border-l-4 border-accent pl-3 font-semibold" : "pl-4"}`}
                    >
                      <time className="tabular-nums text-muted">{a.hora}</time>
                      <span>{a.bloque}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="premios" className="mx-auto max-w-6xl px-4 py-16">
        <h2 id="premios" className="text-2xl font-semibold sm:text-3xl">
          Premios
        </h2>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full max-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-4 font-semibold">Premio</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Alcance</th>
                <th scope="col" className="py-2 font-semibold">Monto o beneficio</th>
              </tr>
            </thead>
            <tbody>
              {PREMIOS.map((p) => (
                <tr key={p.premio} className="border-b border-border">
                  <td className="py-2 pr-4">{p.premio}</td>
                  <td className="py-2 pr-4 text-muted">{p.alcance}</td>
                  <td className="py-2">{mostrar(p.beneficio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-prose text-sm text-muted">
          Un equipo puede recibir como máximo un premio general y un premio especial. Los premios económicos de la categoría
          Junior se entregan al representante legal.
        </p>
      </section>

      <section aria-labelledby="aliados" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="aliados" className="text-2xl font-semibold sm:text-3xl">
            Aliados
          </h2>
          {ALIADOS.length === 0 ? (
            <p className="mt-4 text-muted">Por anunciar.</p>
          ) : (
            <ul className="mt-6 flex flex-wrap gap-6">
              {ALIADOS.map((a) => (
                <li key={a.nombre}>
                  <a href={a.url} className={enlace} rel="noopener noreferrer">
                    {a.nombre}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="faq" className="mx-auto max-w-6xl px-4 py-16">
        <h2 id="faq" className="text-2xl font-semibold sm:text-3xl">
          Preguntas frecuentes
        </h2>
        <div className="mt-8 grid max-w-3xl gap-3">
          {FAQ.map((f) => (
            <details key={f.pregunta} className="rounded border border-border bg-surface px-4 py-3">
              <summary className="cursor-pointer font-medium">{f.pregunta}</summary>
              <p className="mt-2 max-w-prose">{f.respuesta}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-sm">
          ¿Más dudas? Lee la{" "}
          <Link href="/guia" className={enlace}>
            guía oficial
          </Link>{" "}
          y la{" "}
          <Link href="/rubrica" className={enlace}>
            rúbrica de evaluación
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="cta" className="border-t border-border bg-navy-900 text-paper-50">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 id="cta" className="text-2xl font-semibold sm:text-3xl">
            Trae un problema real. Llévate algo que funciona.
          </h2>
          <div className="mt-8 [&_a]:text-paper-50 [&_.bg-accent]:text-navy-900">
            <EstadoInscripciones />
          </div>
        </div>
      </section>
    </>
  );
}
