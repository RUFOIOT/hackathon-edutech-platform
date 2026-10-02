import Image from "next/image";
import Link from "next/link";
import { AGENDA, ALIADOS, EVENT, FAQ, PREMIOS, PREMIO_TRANSVERSAL, TRACKS, TRACK_CODES, fecha, mostrar, type TrackCode } from "@/config/event";
import { MEDIOS } from "@/config/medios";
import { HeroInfinito } from "@/components/hero-infinito";
import { Revelar } from "@/components/revelar";
import { diaEnEcuador, fechaEnEcuador } from "@/lib/event/countdown";
import { faseActual, inscripcionesAbiertas } from "@/lib/event/phase";
import { ahora } from "@/lib/event/reloj";
import { asset, enlacePlataforma } from "@/lib/sitio";

// Se regenera cada 5 minutos: el estado de las inscripciones depende de la fecha.
export const revalidate = 300;

const enlace = "font-medium text-positive-text underline underline-offset-4";
const COLOR_TRACK: Record<TrackCode, string> = { T1: "var(--color-ocho-azul)", T2: "var(--color-ocho-verde)", T3: "var(--color-ocho-ambar)" };

/** Íconos de trazo simple por track (decorativos: el nombre del track va en texto). */
function IconoTrack({ track }: { track: TrackCode }) {
  const comun = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      {track === "T1" && <path {...comun} d="M12 3 2 8l10 5 10-5-10-5Zm-6 7.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" />}
      {track === "T2" && <path {...comun} d="M4 5h16v10H4zM8 19h8M12 15v4M7 9h4M7 12h7" />}
      {track === "T3" && <path {...comun} d="M4 19V9l8-5 8 5v10M9 19v-5h6v5M3 19h18" />}
    </svg>
  );
}

function EstadoInscripciones({ oscuro = false }: { oscuro?: boolean }) {
  const t = ahora();
  const registro = enlacePlataforma("/registro");
  if (inscripcionesAbiertas(t) && registro) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a
          href={registro}
          className="rounded-full bg-accent px-7 py-3.5 font-semibold text-on-accent shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_25%,transparent)] transition hover:brightness-105"
        >
          Inscribir a mi equipo
        </a>
        <a
          href={registro}
          className={`rounded-full border px-6 py-3.5 font-medium transition ${oscuro ? "border-paper-50/60 text-paper-50 hover:bg-paper-50/10" : "border-border hover:bg-surface"}`}
        >
          Inscribirme y buscar equipo
        </a>
      </div>
    );
  }
  const apertura = EVENT.fechas.aperturaInscripciones;
  return (
    <p className="text-center">
      {faseActual(t) === "Convocatoria" ? (
        <>
          Las inscripciones abren el <strong>{diaEnEcuador(fecha("aperturaInscripciones"))}</strong>
          {apertura.confirmada ? "." : " (fecha por confirmar)."}{" "}
          <Link href="/guia-hacker" className={oscuro ? "font-medium underline underline-offset-4" : enlace}>
            Prepárate con la Guía del hacker
          </Link>
        </>
      ) : inscripcionesAbiertas(t) ? (
        "Las inscripciones están abiertas en la plataforma oficial del hackathon."
      ) : (
        "Las inscripciones están cerradas."
      )}
    </p>
  );
}

export default function Inicio() {
  const dias = ["Viernes 6", "Sábado 7"] as const;
  const retos = TRACK_CODES.flatMap((t) => TRACKS[t].ejemplos);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section aria-labelledby="titulo" className="relative isolate overflow-hidden bg-navy-900 text-paper-50">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <span className="mancha left-[-10%] top-[-20%] h-[28rem] w-[28rem] bg-ocho-azul" />
          <span className="mancha right-[-8%] top-[10%] h-[24rem] w-[24rem] bg-ocho-rosa [animation-delay:-6s]" />
          <span className="mancha bottom-[-25%] left-[20%] h-[26rem] w-[26rem] bg-ocho-verde [animation-delay:-12s]" />
          <span className="mancha bottom-[-10%] right-[15%] h-[18rem] w-[18rem] bg-ocho-ambar [animation-delay:-3s]" />
          {MEDIOS.videoHero && (
            <video className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity" autoPlay muted loop playsInline poster={MEDIOS.videoHero.poster}>
              <source src={MEDIOS.videoHero.src} type="video/mp4" />
            </video>
          )}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--color-navy-900)_85%)]" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 text-center sm:pt-14">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Image src={asset("/brand/eight-academy-logo.png")} alt="Eight Academy, Unidad Educativa" width={507} height={125} priority className="h-10 w-auto rounded-xl sm:h-12" />
            <span aria-hidden="true" className="text-2xl font-light opacity-60">
              ×
            </span>
            <Image src={asset("/brand/n8n_full_white_logo.svg")} alt="n8n" width={120} height={40} unoptimized className="h-7 w-auto sm:h-8" />
          </div>
          <h1 id="titulo" className="mx-auto mt-8 max-w-[18ch] text-[2.4rem] font-semibold leading-[1.05] sm:text-6xl">
            Hackathon <span className="bg-gradient-to-r from-ocho-azul via-ocho-rosa to-ocho-ambar bg-clip-text text-transparent">EduTech</span> Eight
            Academy by n8n
          </h1>
          <p className="mx-auto mt-5 max-w-prose text-lg opacity-85">
            Viernes 6 y sábado 7 de noviembre de 2026 · {EVENT.sede.nombre}, {EVENT.sede.ciudad}. Construye en vivo lo que la educación necesita.
          </p>
          <div className="mt-10">
            <HeroInfinito objetivoIso={EVENT.fechas.kickoff.iso} etiquetaObjetivo={fechaEnEcuador(fecha("kickoff"))} />
          </div>
          <div className="mt-10">
            <EstadoInscripciones oscuro />
          </div>
        </div>

        {/* Cinta de retos de ejemplo. */}
        <div className="border-y border-paper-50/10 bg-navy-700/40 py-3">
          <p className="sr-only">Retos de ejemplo: {retos.join(", ")}.</p>
          <div className="overflow-hidden" aria-hidden="true">
            <ul className="cinta flex w-max gap-8 whitespace-nowrap text-sm opacity-85">
              {[...retos, ...retos].map((r, i) => (
                <li key={i} className="flex items-center gap-8">
                  {r}
                  <span className="h-1.5 w-1.5 rounded-full bg-ocho-ambar" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Qué es + cifras ---------- */}
      <section aria-labelledby="que-es" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <Revelar>
            <h2 id="que-es" className="text-3xl font-semibold sm:text-4xl">
              Construye en vivo lo que la educación necesita
            </h2>
            <p className="mt-5 max-w-prose text-lg">
              Estudiantes, universitarios y profesionales construyen soluciones funcionales para los problemas reales de la educación: cómo
              aprende un estudiante, cómo funciona una institución y cómo se sostiene.
            </p>
            <blockquote className="mt-8 border-l-4 border-ocho-ambar pl-5 font-display text-2xl leading-snug">
              Se premia lo que funciona en vivo y está en el repositorio, no lo que se promete en una diapositiva.
            </blockquote>
          </Revelar>
          <dl className="grid grid-cols-2 gap-4">
            {[
              { n: "20,5 h", t: "de hacking", d: "Viernes 15:30 a sábado 12:00", c: "var(--color-ocho-azul)" },
              { n: "3", t: "tracks", d: "Más el premio n8n transversal", c: "var(--color-ocho-rosa)" },
              { n: "2–5", t: "personas por equipo", d: "O inscríbete solo: te asignamos equipo", c: "var(--color-ocho-verde)" },
              { n: "12 min", t: "de Show and Tell", d: "8 de demo en vivo, 4 de preguntas", c: "var(--color-ocho-ambar)" },
            ].map((x, i) => (
              <Revelar key={x.t} retraso={i * 90}>
                <div className="h-full rounded-2xl border border-border bg-surface p-5" style={{ boxShadow: `inset 0 4px 0 ${x.c}` }}>
                  <dt className="sr-only">{x.t}</dt>
                  <dd className="font-display text-4xl font-semibold tabular-nums">{x.n}</dd>
                  <dd className="mt-1 font-medium">{x.t}</dd>
                  <dd className="mt-1 text-sm text-muted">{x.d}</dd>
                </div>
              </Revelar>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- Tracks ---------- */}
      <section aria-labelledby="tracks" className="relative overflow-hidden border-y border-border bg-surface py-20">
        <div className="mx-auto max-w-6xl px-4">
          <Revelar>
            <h2 id="tracks" className="text-3xl font-semibold sm:text-4xl">
              Tres tracks, un premio transversal
            </h2>
            <p className="mt-3 max-w-prose text-muted">Cada equipo compite en un solo track. Puedes cambiarlo hasta el checkpoint 1.</p>
          </Revelar>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {TRACK_CODES.map((code, i) => (
              <li key={code}>
                <Revelar retraso={i * 120} className="h-full">
                  <Link
                    href="/tracks"
                    className="group flex h-full flex-col rounded-2xl border border-border bg-bg p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_var(--color-navy-700)]"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl text-navy-900" style={{ backgroundColor: COLOR_TRACK[code] }}>
                      <IconoTrack track={code} />
                    </span>
                    <p className="mt-5 text-sm font-medium text-muted">{code}</p>
                    <h3 className="mt-1 text-xl font-semibold">{TRACKS[code].nombre}</h3>
                    <p className="mt-3 flex-1 text-sm">{TRACKS[code].pregunta}</p>
                    <span className="mt-5 text-sm font-medium text-positive-text group-hover:underline">Ver retos de ejemplo →</span>
                  </Link>
                </Revelar>
              </li>
            ))}
          </ul>

          <Revelar className="mt-8">
            <div className="flex flex-col items-start gap-5 rounded-2xl bg-navy-900 p-6 text-paper-50 sm:flex-row sm:items-center">
              <Image src={asset("/brand/n8n_pink+white_logo.svg")} alt="n8n" width={110} height={36} unoptimized className="h-8 w-auto" />
              <div>
                <p className="font-display text-xl font-semibold">{PREMIO_TRANSVERSAL}</p>
                <p className="mt-1 text-sm opacity-85">
                  La mejor automatización construida con n8n, en cualquier track. Exporta tus workflows a <code className="font-mono">/n8n</code>.
                </p>
              </div>
              <span
                aria-hidden="true"
                className="ml-auto hidden h-12 w-12 rounded-full sm:block"
                style={{ background: "radial-gradient(circle, var(--color-n8n), transparent 70%)" }}
              />
            </div>
          </Revelar>
        </div>
      </section>

      {/* ---------- Galería (aparece cuando haya fotos o videos en config/medios.ts) ---------- */}
      {MEDIOS.galeria.length > 0 && (
        <section aria-labelledby="galeria" className="mx-auto max-w-6xl px-4 py-20">
          <h2 id="galeria" className="text-3xl font-semibold sm:text-4xl">
            Así se vive
          </h2>
          <ul className="mt-8 grid auto-rows-[12rem] grid-cols-2 gap-4 md:grid-cols-4">
            {MEDIOS.galeria.map((m, i) => (
              <li key={m.src} className={`overflow-hidden rounded-2xl ${i % 5 === 0 ? "col-span-2 row-span-2" : ""}`}>
                <Revelar retraso={(i % 4) * 80} className="h-full">
                  {m.tipo === "video" ? (
                    <video src={m.src} className="h-full w-full object-cover" muted loop playsInline autoPlay aria-label={m.alt} />
                  ) : (
                    <Image src={m.src} alt={m.alt} width={800} height={600} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
                  )}
                </Revelar>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Agenda ---------- */}
      <section aria-labelledby="agenda" className="mx-auto max-w-6xl px-4 py-20">
        <Revelar>
          <h2 id="agenda" className="text-3xl font-semibold sm:text-4xl">
            Agenda
          </h2>
          <p className="mt-2 text-sm text-muted">Hora de Ecuador (UTC-5).</p>
        </Revelar>
        <div className="mt-10 grid gap-12 md:grid-cols-2">
          {dias.map((dia, d) => (
            <Revelar key={dia} retraso={d * 120}>
              <h3 className="text-xl font-semibold">{dia} de noviembre</h3>
              <ol className="relative mt-6 grid gap-5 border-l-2 border-border pl-6">
                {AGENDA.filter((a) => a.dia === dia).map((a) => (
                  <li key={`${a.hora}-${a.bloque}`} className="relative">
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[33px] top-1 h-4 w-4 rounded-full border-2 border-bg ${a.hito ? "bg-ocho-ambar ring-4 ring-ocho-ambar/25" : "bg-ocho-azul"}`}
                    />
                    <time className="text-sm font-semibold tabular-nums text-muted">{a.hora}</time>
                    <p className={a.hito ? "font-semibold" : ""}>{a.bloque}</p>
                  </li>
                ))}
              </ol>
            </Revelar>
          ))}
        </div>
      </section>

      {/* ---------- Premios ---------- */}
      <section aria-labelledby="premios" className="border-y border-border bg-surface py-20">
        <div className="mx-auto max-w-6xl px-4">
          <Revelar>
            <h2 id="premios" className="text-3xl font-semibold sm:text-4xl">
              Premios
            </h2>
          </Revelar>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PREMIOS.map((p, i) => (
              <li key={p.premio}>
                <Revelar retraso={(i % 4) * 80} className="h-full">
                  <div className={`h-full rounded-2xl p-5 ${i < 3 ? "borde-ocho" : "border border-border bg-bg"}`}>
                    {i < 3 && <p className="font-display text-3xl font-semibold">{i + 1}.º</p>}
                    <p className="mt-1 font-semibold">{p.premio}</p>
                    <p className="text-sm text-muted">{p.alcance}</p>
                    <p className="mt-3 text-sm font-medium">{mostrar(p.beneficio)}</p>
                  </div>
                </Revelar>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-prose text-sm text-muted">
            Un equipo puede recibir como máximo un premio general y un premio especial. Los premios económicos de la categoría Junior se entregan
            al representante legal.
          </p>
        </div>
      </section>

      {/* ---------- Aliados ---------- */}
      <section aria-labelledby="aliados" className="mx-auto max-w-6xl px-4 py-16">
        <h2 id="aliados" className="text-3xl font-semibold sm:text-4xl">
          Aliados
        </h2>
        <ul className="mt-8 flex flex-wrap items-center gap-10">
          <li>
            <Image src={asset("/brand/eight-academy-logo.png")} alt="Eight Academy, Unidad Educativa (organiza)" width={507} height={125} className="h-12 w-auto rounded-xl" />
          </li>
          <li>
            <Image src={asset("/brand/n8n_pink+black_logo.svg")} alt="n8n (aliado tecnológico)" width={120} height={40} unoptimized className="h-9 w-auto dark:hidden" />
            <Image src={asset("/brand/n8n_pink+white_logo.svg")} alt="n8n (aliado tecnológico)" width={120} height={40} unoptimized className="hidden h-9 w-auto dark:block" />
          </li>
          {ALIADOS.map((a) => (
            <li key={a.nombre}>
              <a href={a.url} className={enlace} rel="noopener noreferrer">
                {a.nombre}
              </a>
            </li>
          ))}
          {ALIADOS.length === 0 && <li className="text-muted">Más aliados: por anunciar.</li>}
        </ul>
      </section>

      {/* ---------- Preguntas frecuentes ---------- */}
      <section aria-labelledby="faq" className="mx-auto max-w-6xl px-4 pb-20">
        <h2 id="faq" className="text-3xl font-semibold sm:text-4xl">
          Preguntas frecuentes
        </h2>
        <div className="mt-8 grid max-w-3xl gap-3">
          {FAQ.map((f) => (
            <details key={f.pregunta} className="group rounded-2xl border border-border bg-surface px-5 py-4 open:shadow-[inset_4px_0_0_var(--color-ocho-azul)]">
              <summary className="cursor-pointer list-none font-medium after:float-right after:content-['+'] group-open:after:content-['−']">{f.pregunta}</summary>
              <p className="mt-3 max-w-prose">{f.respuesta}</p>
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

      {/* ---------- Cierre ---------- */}
      <section aria-labelledby="cta" className="relative isolate overflow-hidden bg-navy-900 text-paper-50">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <span className="mancha left-[5%] top-[-30%] h-80 w-80 bg-ocho-rosa" />
          <span className="mancha bottom-[-40%] right-[5%] h-96 w-96 bg-ocho-azul [animation-delay:-9s]" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h2 id="cta" className="mx-auto max-w-[22ch] text-3xl font-semibold sm:text-5xl">
            Trae un problema real. Llévate algo que funciona.
          </h2>
          <div className="mt-10">
            <EstadoInscripciones oscuro />
          </div>
        </div>
      </section>
    </>
  );
}
