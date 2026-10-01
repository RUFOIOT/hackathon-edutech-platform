import { EVENT, fecha, type TrackCode } from "@/config/event";
import { debeAnalizarse, detectarSecretos, esArchivoEnv, type Hallazgo } from "@/lib/github/secretos";

/**
 * Integración con GitHub (prompt §8.1). Las funciones reciben un `GitHubCliente` inyectado:
 * en producción es Octokit con la GitHub App (lib/github/cliente.ts); en tests, un cliente
 * simulado con respuestas controladas.
 */

export interface RepoInfo {
  owner: string;
  name: string;
  createdAt: Date;
  defaultBranch: string;
  privado: boolean;
}

export interface CommitInfo {
  sha: string;
  fecha: Date;
  autor: string | null; // login de GitHub, o nombre si el correo no está vinculado
}

export interface ArchivoArbol {
  path: string;
  tipo: "blob" | "tree";
  sha: string;
  size?: number;
}

export interface GitHubCliente {
  repo(owner: string, name: string): Promise<RepoInfo | null>;
  commits(owner: string, name: string, opts: { since?: Date; until?: Date; path?: string; max?: number }): Promise<CommitInfo[]>;
  arbol(owner: string, name: string, ref: string): Promise<ArchivoArbol[]>;
  contenido(owner: string, name: string, blobSha: string): Promise<string>;
  /** Commit al que apunta un tag (resuelve tags anotados). null si no existe. */
  tag(owner: string, name: string, tag: string): Promise<{ sha: string; fecha: Date } | null>;
}

// ---------------------------------------------------------------------------
// validateRepo
// ---------------------------------------------------------------------------

export interface Chequeo {
  id: "url" | "organizacion" | "patron" | "track" | "equipo" | "existe" | "fecha";
  ok: boolean;
  mensaje: string;
}

export interface ResultadoValidacion {
  valido: boolean;
  owner: string | null;
  name: string | null;
  createdAt: Date | null;
  defaultBranch: string | null;
  chequeos: Chequeo[];
}

export function parsearUrlRepo(url: string): { owner: string; name: string } | null {
  const m = /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? { owner: m[1]!, name: m[2]! } : null;
}

/**
 * Valida el repositorio de un equipo: URL, organización, patrón `edutech26-t{1|2|3}-{slug}`,
 * track y slug del equipo, existencia y creación posterior al kick-off. Cada chequeo explica
 * con texto qué se esperaba (se muestra tal cual al equipo).
 */
export async function validateRepo(
  url: string,
  team: { slug: string; track: TrackCode },
  cliente: GitHubCliente,
  opts: { org?: string; kickoff?: Date } = {},
): Promise<ResultadoValidacion> {
  const org = opts.org ?? EVENT.githubOrg;
  const kickoff = opts.kickoff ?? fecha("kickoff");
  const esperado = `edutech26-${team.track.toLowerCase()}-${team.slug}`;
  const chequeos: Chequeo[] = [];
  const fin = (info: RepoInfo | null, owner: string | null, name: string | null): ResultadoValidacion => ({
    valido: chequeos.every((c) => c.ok),
    owner,
    name,
    createdAt: info?.createdAt ?? null,
    defaultBranch: info?.defaultBranch ?? null,
    chequeos,
  });

  const partes = parsearUrlRepo(url);
  chequeos.push({
    id: "url",
    ok: !!partes,
    mensaje: partes ? "La URL es de un repositorio de GitHub." : "La URL debe tener la forma https://github.com/organizacion/repositorio.",
  });
  if (!partes) return fin(null, null, null);
  const { owner, name } = partes;

  const enOrg = owner.toLowerCase() === org.toLowerCase();
  chequeos.push({
    id: "organizacion",
    ok: enOrg,
    mensaje: enOrg ? `Pertenece a la organización ${org}.` : `El repositorio debe estar en la organización ${org}, no en ${owner}.`,
  });

  const patron = EVENT.repoPattern.exec(name);
  chequeos.push({
    id: "patron",
    ok: !!patron,
    mensaje: patron
      ? "El nombre sigue el patrón edutech26-t{track}-{slug}."
      : `El nombre debe seguir el patrón edutech26-t{1|2|3}-{slug}; para tu equipo: ${esperado}.`,
  });
  if (patron) {
    const trackRepo = `T${patron[1]}`;
    chequeos.push({
      id: "track",
      ok: trackRepo === team.track,
      mensaje:
        trackRepo === team.track
          ? `El track del nombre (${trackRepo}) coincide con el del equipo.`
          : `El nombre indica ${trackRepo}, pero tu equipo está inscrito en ${team.track}. Renómbralo a ${esperado} o cambia el track antes del checkpoint 1.`,
    });
    chequeos.push({
      id: "equipo",
      ok: patron[2] === team.slug,
      mensaje: patron[2] === team.slug ? "El slug coincide con el de tu equipo." : `El slug del nombre debe ser el de tu equipo: ${esperado}.`,
    });
  }

  const info = enOrg ? await cliente.repo(owner, name) : null;
  if (enOrg) {
    chequeos.push({
      id: "existe",
      ok: !!info,
      mensaje: info ? "El repositorio existe y la plataforma puede leerlo." : "No encontramos el repositorio o la plataforma no tiene acceso. Revisa el nombre.",
    });
  }
  if (info) {
    const despues = info.createdAt.getTime() >= kickoff.getTime();
    chequeos.push({
      id: "fecha",
      ok: despues,
      mensaje: despues
        ? "Se creó después del kick-off."
        : "Se creó antes del kick-off (viernes 15:30). Un repositorio creado antes no se acepta: crea uno nuevo desde la plantilla.",
    });
  }
  return fin(info, owner, name);
}

// ---------------------------------------------------------------------------
// snapshotRepo
// ---------------------------------------------------------------------------

export type EstadoCheckpoint = "cumplido" | "pendiente" | "vencido";

export interface Alerta {
  tipo: "repo-antes-kickoff" | "commits-antes-kickoff" | "secreto" | "env-versionado" | "sin-commits-3h" | "un-solo-autor" | "checkpoint-vencido";
  nivel: "roja" | "ambar";
  detalle: string;
}

export interface Snapshot {
  tomadoEn: Date;
  commitsEnVentana: number;
  autores: string[];
  ultimoCommitAt: Date | null;
  commitsPorHora: Record<string, number>; // "2026-11-06T15" en hora de Ecuador
  archivosObligatorios: Record<string, boolean>;
  secretos: Hallazgo[];
  alertas: Alerta[];
  checkpoint1: EstadoCheckpoint;
  checkpoint2: EstadoCheckpoint;
  /** El checkpoint 2 ("algo ejecutable") solo tiene indicios automáticos: la mesa técnica confirma. */
  checkpoint2RequiereRevision: boolean;
}

/** Caché de blobs ya analizados (por SHA, que identifica el contenido): evita re-escanear cada 15 min. */
export interface CacheSecretos {
  leer(shas: string[]): Promise<Map<string, Omit<Hallazgo, "archivo">[]>>;
  guardar(resultados: Map<string, Omit<Hallazgo, "archivo">[]>): Promise<void>;
}

export const ARCHIVOS_OBLIGATORIOS = ["README.md", "PRIOR_WORK.md", "AI_USAGE.md", ".env.example", "docs/", "n8n/*.json", "LICENSE", "data/README.md"] as const;

const MAX_BLOBS_POR_SNAPSHOT = 300;

/** Hora de Ecuador (UTC-5 fijo) como clave "AAAA-MM-DDTHH". */
export function horaEcuador(d: Date): string {
  return new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 13);
}

export function estadoCheckpoint(cumple: boolean, limite: Date, ahora: Date): EstadoCheckpoint {
  if (cumple) return "cumplido";
  return ahora.getTime() < limite.getTime() ? "pendiente" : "vencido";
}

/** Secciones "## Título" del README con su texto, sin comentarios HTML (los marcadores COMPLETAR de la plantilla). */
export function seccionesReadme(md: string): Map<string, string> {
  const secciones = new Map<string, string>();
  for (const parte of md.split(/^##\s+/m).slice(1)) {
    const [titulo = "", ...resto] = parte.split("\n");
    const cuerpo = resto.join("\n").replace(/<!--[\s\S]*?-->/g, "").trim();
    const clave = titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    secciones.set(clave, cuerpo);
  }
  return secciones;
}

/** ¿El README tiene las secciones pedidas con contenido propio (no el de la plantilla)? */
export function readmeCompleto(md: string, claves: string[]): boolean {
  const secciones = [...seccionesReadme(md).entries()];
  return claves.every((clave) => secciones.some(([titulo, cuerpo]) => titulo.includes(clave) && cuerpo.length >= 40));
}

/** Guía del Hacker §5 · checkpoint 1: README con problema, usuario, evidencia y arquitectura. */
export const SECCIONES_CHECKPOINT1 = ["problema", "usuario", "evidencia", "arquitectura"];
/** Indicio del checkpoint 2: instrucciones para ejecutarlo. */
export const SECCIONES_CHECKPOINT2 = ["como correrlo"];

export async function snapshotRepo(
  repo: { owner: string; name: string; createdAt: Date; defaultBranch?: string },
  cliente: GitHubCliente,
  opts: { ahora: Date; kickoff?: Date; freeze?: Date; checkpoint1?: Date; checkpoint2?: Date; cache?: CacheSecretos },
): Promise<Snapshot> {
  const kickoff = opts.kickoff ?? fecha("kickoff");
  const freeze = opts.freeze ?? fecha("codeFreeze");
  const cp1 = opts.checkpoint1 ?? fecha("checkpoint1");
  const cp2 = opts.checkpoint2 ?? fecha("checkpoint2");
  const { owner, name } = repo;
  const ref = repo.defaultBranch ?? "main";

  const [enVentana, previos, readmeAntesCp1, codigoAntesCp2, arbol] = await Promise.all([
    cliente.commits(owner, name, { since: kickoff, until: freeze }),
    cliente.commits(owner, name, { until: new Date(kickoff.getTime() - 1000), max: 1 }),
    cliente.commits(owner, name, { since: kickoff, until: cp1, path: "README.md", max: 1 }),
    cliente.commits(owner, name, { since: kickoff, until: cp2, path: "src", max: 1 }),
    cliente.arbol(owner, name, ref),
  ]);

  const autores = [...new Set(enVentana.map((c) => c.autor).filter((a): a is string => !!a))].sort();
  const ultimoCommitAt = enVentana.reduce<Date | null>((max, c) => (!max || c.fecha > max ? c.fecha : max), null);
  const commitsPorHora: Record<string, number> = {};
  for (const c of enVentana) {
    const h = horaEcuador(c.fecha);
    commitsPorHora[h] = (commitsPorHora[h] ?? 0) + 1;
  }

  const paths = new Set(arbol.map((a) => (a.tipo === "tree" ? `${a.path}/` : a.path)));
  const archivosObligatorios: Record<string, boolean> = {};
  for (const req of ARCHIVOS_OBLIGATORIOS) {
    archivosObligatorios[req] =
      req === "n8n/*.json" ? arbol.some((a) => a.tipo === "blob" && /^n8n\/[^/]+\.json$/.test(a.path)) : paths.has(req);
  }

  // README actual (para los checkpoints).
  const readme = arbol.find((a) => a.path === "README.md" && a.tipo === "blob");
  const textoReadme = readme ? await cliente.contenido(owner, name, readme.sha) : "";

  // Secretos: solo blobs de texto nuevos (la caché recuerda los SHA ya analizados).
  const candidatos = arbol.filter((a) => a.tipo === "blob" && debeAnalizarse(a.path, a.size));
  const enCache = (await opts.cache?.leer(candidatos.map((c) => c.sha))) ?? new Map<string, Omit<Hallazgo, "archivo">[]>();
  const nuevos = new Map<string, Omit<Hallazgo, "archivo">[]>();
  const secretos: Hallazgo[] = [];
  for (const archivo of candidatos) {
    let hallazgos = enCache.get(archivo.sha) ?? nuevos.get(archivo.sha);
    if (!hallazgos) {
      if (nuevos.size >= MAX_BLOBS_POR_SNAPSHOT) continue; // el resto se analiza en el siguiente snapshot
      const contenido = archivo.sha === readme?.sha ? textoReadme : await cliente.contenido(owner, name, archivo.sha);
      hallazgos = detectarSecretos(archivo.path, contenido).map(({ tipo, linea, muestra }) => ({ tipo, linea, muestra }));
      nuevos.set(archivo.sha, hallazgos);
    }
    secretos.push(...hallazgos.map((h) => ({ ...h, archivo: archivo.path })));
  }
  if (nuevos.size) await opts.cache?.guardar(nuevos);

  const cumpleCp1 = readmeAntesCp1.length > 0 && readmeCompleto(textoReadme, SECCIONES_CHECKPOINT1);
  const cumpleCp2 = codigoAntesCp2.length > 0 && readmeCompleto(textoReadme, SECCIONES_CHECKPOINT2);
  const checkpoint1 = estadoCheckpoint(cumpleCp1, cp1, opts.ahora);
  const checkpoint2 = estadoCheckpoint(cumpleCp2, cp2, opts.ahora);

  const alertas: Alerta[] = [];
  if (repo.createdAt < kickoff) alertas.push({ tipo: "repo-antes-kickoff", nivel: "roja", detalle: "El repositorio se creó antes del kick-off." });
  if (previos.length > 0) {
    alertas.push({
      tipo: "commits-antes-kickoff",
      nivel: "roja",
      detalle: "Hay commits anteriores al kick-off: verificar que estén declarados en PRIOR_WORK.md.",
    });
  }
  for (const s of secretos) alertas.push({ tipo: "secreto", nivel: "roja", detalle: `${s.tipo} en ${s.archivo}:${s.linea} (${s.muestra})` });
  for (const a of arbol) {
    if (a.tipo === "blob" && esArchivoEnv(a.path)) alertas.push({ tipo: "env-versionado", nivel: "roja", detalle: `Archivo ${a.path} versionado.` });
  }
  const tresHoras = 3 * 3600_000;
  const enVentanaAhora = opts.ahora >= kickoff && opts.ahora < freeze;
  const sinActividad = !ultimoCommitAt || opts.ahora.getTime() - ultimoCommitAt.getTime() >= tresHoras;
  if (enVentanaAhora && opts.ahora.getTime() - kickoff.getTime() >= tresHoras && sinActividad) {
    alertas.push({ tipo: "sin-commits-3h", nivel: "ambar", detalle: "Sin commits en las últimas 3 horas." });
  }
  if (enVentana.length > 0 && autores.length === 1) {
    alertas.push({ tipo: "un-solo-autor", nivel: "ambar", detalle: `Todos los commits son de ${autores[0]}.` });
  }
  if (checkpoint1 === "vencido") {
    alertas.push({ tipo: "checkpoint-vencido", nivel: "roja", detalle: "Checkpoint 1 vencido: el README no tiene problema, usuario, evidencia y arquitectura." });
  }
  if (checkpoint2 === "vencido") {
    alertas.push({ tipo: "checkpoint-vencido", nivel: "roja", detalle: "Checkpoint 2 sin indicios: no hay código en src/ ni instrucciones para ejecutarlo." });
  }

  return {
    tomadoEn: opts.ahora,
    commitsEnVentana: enVentana.length,
    autores,
    ultimoCommitAt,
    commitsPorHora,
    archivosObligatorios,
    secretos,
    alertas,
    checkpoint1,
    checkpoint2,
    checkpoint2RequiereRevision: true,
  };
}

// ---------------------------------------------------------------------------
// resolveDeliveryTag
// ---------------------------------------------------------------------------

export interface TagEntrega {
  existe: boolean;
  sha: string | null;
  commitAt: Date | null;
  /** El commit etiquetado tiene fecha posterior al code freeze. */
  posteriorAlFreeze: boolean;
  /** El tag apunta a un SHA distinto del registrado en la entrega (se movió). */
  movido: boolean;
}

export async function resolveDeliveryTag(
  repo: { owner: string; name: string },
  cliente: GitHubCliente,
  opts: { freeze?: Date; shaRegistrado?: string | null; tag?: string } = {},
): Promise<TagEntrega> {
  const freeze = opts.freeze ?? fecha("codeFreeze");
  const t = await cliente.tag(repo.owner, repo.name, opts.tag ?? EVENT.tagEntrega);
  if (!t) return { existe: false, sha: null, commitAt: null, posteriorAlFreeze: false, movido: !!opts.shaRegistrado };
  return {
    existe: true,
    sha: t.sha,
    commitAt: t.fecha,
    posteriorAlFreeze: t.fecha.getTime() > freeze.getTime(),
    movido: !!opts.shaRegistrado && opts.shaRegistrado !== t.sha,
  };
}

// ---------------------------------------------------------------------------
// Admisibilidad A1–A5 (rúbrica §1)
// ---------------------------------------------------------------------------

export interface Admisibilidad {
  a1: boolean; // repo en la organización, creado después del kick-off
  a2: boolean; // tag entrega antes de las 12:00 y no movido después
  a3: boolean; // README.md, PRIOR_WORK.md y AI_USAGE.md presentes
  a4: boolean | null; // corresponde al track: lo decide la mesa técnica (null = pendiente)
  a5: boolean; // declaración de datos sintéticos en el formulario de entrega
  motivos: string[];
}

export function calcularAdmisibilidad(e: {
  validacion: Pick<ResultadoValidacion, "chequeos"> | null;
  tag: TagEntrega | null;
  tagMovidoTrasFreeze: boolean; // registrado por el webhook
  archivos: Record<string, boolean> | null;
  a4: boolean | null;
  declaracionDatosSinteticos: boolean;
}): Admisibilidad {
  const motivos: string[] = [];
  const chequeo = (id: Chequeo["id"]) => e.validacion?.chequeos.find((c) => c.id === id)?.ok === true;
  const a1 = chequeo("organizacion") && chequeo("existe") && chequeo("fecha");
  if (!a1) motivos.push("A1: el repositorio no está en la organización oficial o se creó antes del kick-off.");
  const a2 = !!e.tag?.existe && !e.tag.posteriorAlFreeze && !e.tag.movido && !e.tagMovidoTrasFreeze;
  if (!a2) motivos.push("A2: falta el tag entrega, apunta a un commit posterior al code freeze o se movió después.");
  const a3 = !!e.archivos && ["README.md", "PRIOR_WORK.md", "AI_USAGE.md"].every((f) => e.archivos![f]);
  if (!a3) motivos.push("A3: faltan README.md, PRIOR_WORK.md o AI_USAGE.md.");
  if (e.a4 === false) motivos.push("A4: la mesa técnica determinó que el proyecto no corresponde al track inscrito.");
  if (!e.declaracionDatosSinteticos) motivos.push("A5: falta la declaración de datos sintéticos.");
  return { a1, a2, a3, a4: e.a4, a5: e.declaracionDatosSinteticos, motivos };
}
