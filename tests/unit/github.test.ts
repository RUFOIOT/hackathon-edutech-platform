import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calcularAdmisibilidad,
  horaEcuador,
  parsearUrlRepo,
  readmeCompleto,
  resolveDeliveryTag,
  snapshotRepo,
  validateRepo,
  type ArchivoArbol,
  type CacheSecretos,
  type CommitInfo,
  type GitHubCliente,
} from "@/lib/github";
import { detectarSecretos, esArchivoEnv } from "@/lib/github/secretos";
import { movimientoDeTag, verificarFirmaGithub } from "@/lib/github/webhook";

// Fechas del evento (hora de Ecuador).
const ec = (s: string) => new Date(`${s}-05:00`);
const KICKOFF = ec("2026-11-06T15:30:00");
const FREEZE = ec("2026-11-07T12:00:00");

const README_COMPLETO = `# Matrícula Express

## Problema
Las matrículas toman tres días de filas en la secretaría y las familias pierden jornadas de trabajo.

## Usuario
Secretaria académica (EST-014) y familias de primer año; entrevistamos a dos secretarias y tres madres.

## Evidencia de la entrevista
EST-014 dijo que el 60 % del tiempo se va en transcribir formularios en papel al sistema académico.

## Arquitectura
Formulario web en Next.js, flujo n8n que valida documentos y escribe en Google Sheets, correo con Resend.

## Cómo correrlo
npm install, copiar .env.example a .env y ejecutar npm run dev; importar n8n/matricula.json.
`;

/** Cliente simulado: cada test define el repo, los commits, el árbol, los blobs y el tag. */
function clienteSimulado(o: {
  creado?: Date;
  commits?: (CommitInfo & { paths?: string[] })[];
  arbol?: ArchivoArbol[];
  blobs?: Record<string, string>;
  tag?: { sha: string; fecha: Date } | null;
}): GitHubCliente & { blobsLeidos: string[] } {
  const commits = o.commits ?? [];
  const blobsLeidos: string[] = [];
  return {
    blobsLeidos,
    async repo(owner, name) {
      return o.creado ? { owner, name, createdAt: o.creado, defaultBranch: "main", privado: true } : null;
    },
    async commits(_o, _n, { since, until, path, max }) {
      const r = commits.filter(
        (c) => (!since || c.fecha >= since) && (!until || c.fecha <= until) && (!path || (c.paths ?? []).some((p) => p.startsWith(path))),
      );
      return max ? r.slice(0, max) : r;
    },
    async arbol() {
      return o.arbol ?? [];
    },
    async contenido(_o, _n, sha) {
      blobsLeidos.push(sha);
      return o.blobs?.[sha] ?? "";
    },
    async tag() {
      return o.tag ?? null;
    },
  };
}

const arbolCompleto: ArchivoArbol[] = [
  { path: "README.md", tipo: "blob", sha: "readme" },
  { path: "PRIOR_WORK.md", tipo: "blob", sha: "prior" },
  { path: "AI_USAGE.md", tipo: "blob", sha: "ai" },
  { path: "LICENSE", tipo: "blob", sha: "lic" },
  { path: ".env.example", tipo: "blob", sha: "envex" },
  { path: "docs", tipo: "tree", sha: "docs" },
  { path: "docs/arquitectura.png", tipo: "blob", sha: "png" },
  { path: "n8n", tipo: "tree", sha: "n8n" },
  { path: "n8n/matricula.json", tipo: "blob", sha: "flujo" },
  { path: "data", tipo: "tree", sha: "data" },
  { path: "data/README.md", tipo: "blob", sha: "datareadme" },
  { path: "src", tipo: "tree", sha: "src" },
  { path: "src/index.ts", tipo: "blob", sha: "index" },
];

const commitsSanos: (CommitInfo & { paths?: string[] })[] = [
  { sha: "c1", fecha: ec("2026-11-06T16:05:00"), autor: "ana", paths: ["README.md"] },
  { sha: "c2", fecha: ec("2026-11-06T18:40:00"), autor: "luis", paths: ["README.md"] },
  { sha: "c3", fecha: ec("2026-11-07T09:10:00"), autor: "ana", paths: ["src/index.ts"] },
  { sha: "c4", fecha: ec("2026-11-07T11:30:00"), autor: "luis", paths: ["src/index.ts"] },
];

const equipo = { slug: "matricula-express", track: "T3" as const };
const URL_OK = "https://github.com/eight-academy-hackathon/edutech26-t3-matricula-express";

describe("validateRepo", () => {
  it("acepta un repo válido de la organización, creado después del kick-off", async () => {
    const r = await validateRepo(URL_OK, equipo, clienteSimulado({ creado: ec("2026-11-06T15:42:00") }), { kickoff: KICKOFF });
    expect(r.valido).toBe(true);
    expect(r.chequeos.map((c) => c.id)).toEqual(["url", "organizacion", "patron", "track", "equipo", "existe", "fecha"]);
  });

  it("rechaza un repo creado ANTES del kick-off y explica por qué", async () => {
    const r = await validateRepo(URL_OK, equipo, clienteSimulado({ creado: ec("2026-11-05T20:00:00") }), { kickoff: KICKOFF });
    expect(r.valido).toBe(false);
    expect(r.chequeos.find((c) => c.id === "fecha")).toMatchObject({ ok: false, mensaje: expect.stringMatching(/antes del kick-off/) });
  });

  it("rechaza fuera de la organización, con patrón o track equivocados", async () => {
    const c = clienteSimulado({ creado: ec("2026-11-06T16:00:00") });
    const fuera = await validateRepo("https://github.com/ana/edutech26-t3-matricula-express", equipo, c, { kickoff: KICKOFF });
    expect(fuera.chequeos.find((x) => x.id === "organizacion")?.ok).toBe(false);
    const patron = await validateRepo("https://github.com/eight-academy-hackathon/mi-proyecto", equipo, c, { kickoff: KICKOFF });
    expect(patron.chequeos.find((x) => x.id === "patron")?.mensaje).toContain("edutech26-t3-matricula-express");
    const track = await validateRepo("https://github.com/eight-academy-hackathon/edutech26-t1-matricula-express", equipo, c, { kickoff: KICKOFF });
    expect(track.chequeos.find((x) => x.id === "track")).toMatchObject({ ok: false, mensaje: expect.stringMatching(/T1.*T3/) });
  });

  it("parsea URLs con .git y barra final, y rechaza otras", () => {
    expect(parsearUrlRepo("https://github.com/org/repo.git")).toEqual({ owner: "org", name: "repo" });
    expect(parsearUrlRepo("https://github.com/org/repo/")).toEqual({ owner: "org", name: "repo" });
    expect(parsearUrlRepo("https://gitlab.com/org/repo")).toBeNull();
  });
});

describe("snapshotRepo", () => {
  const base = { owner: "eight-academy-hackathon", name: "edutech26-t3-matricula-express", createdAt: ec("2026-11-06T15:40:00") };
  const opts = { kickoff: KICKOFF, freeze: FREEZE };

  it("repo sano: métricas, archivos obligatorios, checkpoints cumplidos y sin alertas", async () => {
    const c = clienteSimulado({ commits: commitsSanos, arbol: arbolCompleto, blobs: { readme: README_COMPLETO, index: "export const ok = true;" } });
    const s = await snapshotRepo(base, c, { ...opts, ahora: ec("2026-11-07T11:45:00") });
    expect(s.commitsEnVentana).toBe(4);
    expect(s.autores).toEqual(["ana", "luis"]);
    expect(s.ultimoCommitAt).toEqual(ec("2026-11-07T11:30:00"));
    expect(s.commitsPorHora["2026-11-06T16"]).toBe(1);
    expect(Object.values(s.archivosObligatorios).every(Boolean)).toBe(true);
    expect(s.checkpoint1).toBe("cumplido");
    expect(s.checkpoint2).toBe("cumplido");
    expect(s.alertas).toEqual([]);
  });

  it("detecta secretos en el árbol actual (sk-, ghp_, AKIA, service_role) y no guarda el valor", async () => {
    const jwtServiceRole = [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      Buffer.from(JSON.stringify({ iss: "supabase", role: "service_role" })).toString("base64url"),
      "firmaFalsaDePrueba123",
    ].join(".");
    const blobs = {
      readme: README_COMPLETO,
      index: `const openai = "sk-proj-AbCdEfGhIjKlMnOpQrStUvWx1234";\nconst gh = "ghp_${"a".repeat(36)}";`,
      cfg: `AWS_KEY=AKIAABCDEFGHIJKLMNOP\nSUPABASE_SERVICE_ROLE=${jwtServiceRole}`,
    };
    const arbol = [...arbolCompleto, { path: "src/config.ts", tipo: "blob" as const, sha: "cfg" }];
    const s = await snapshotRepo(base, clienteSimulado({ commits: commitsSanos, arbol, blobs }), { ...opts, ahora: ec("2026-11-07T11:45:00") });
    const tipos = s.secretos.map((h) => h.tipo);
    expect(tipos).toEqual(
      expect.arrayContaining([expect.stringMatching(/sk-/), "Token de GitHub", "Clave de acceso de AWS", "Clave service_role de Supabase"]),
    );
    expect(s.alertas.filter((a) => a.tipo === "secreto" && a.nivel === "roja")).toHaveLength(4);
    expect(JSON.stringify(s)).not.toContain("AbCdEfGhIjKlMnOp");
    expect(s.secretos.find((h) => h.tipo === "Clave de acceso de AWS")).toMatchObject({ archivo: "src/config.ts", linea: 1 });
  });

  it("no vuelve a descargar blobs ya analizados (caché por SHA)", async () => {
    const guardado = new Map<string, { tipo: string; linea: number; muestra: string }[]>();
    const cache: CacheSecretos = {
      async leer(shas) {
        return new Map(shas.filter((s) => guardado.has(s)).map((s) => [s, guardado.get(s)!]));
      },
      async guardar(r) {
        for (const [k, v] of r) guardado.set(k, v);
      },
    };
    const datos = { commits: commitsSanos, arbol: arbolCompleto, blobs: { readme: README_COMPLETO } };
    await snapshotRepo(base, clienteSimulado(datos), { ...opts, ahora: ec("2026-11-07T11:00:00"), cache });
    const segundo = clienteSimulado(datos);
    await snapshotRepo(base, segundo, { ...opts, ahora: ec("2026-11-07T11:15:00"), cache });
    expect(segundo.blobsLeidos).toEqual(["readme"]); // solo el README, que se lee para los checkpoints
  });

  it("alerta roja si el repo se creó antes del kick-off o hay commits previos", async () => {
    const commits = [{ sha: "viejo", fecha: ec("2026-11-01T10:00:00"), autor: "ana", paths: ["src/index.ts"] }, ...commitsSanos];
    const cliente = clienteSimulado({ commits, arbol: arbolCompleto, blobs: { readme: README_COMPLETO } });
    const s = await snapshotRepo({ ...base, createdAt: ec("2026-11-01T09:00:00") }, cliente, { ...opts, ahora: ec("2026-11-07T11:45:00") });
    expect(s.alertas.map((a) => a.tipo)).toEqual(expect.arrayContaining(["repo-antes-kickoff", "commits-antes-kickoff"]));
  });

  it("checkpoint 1: pendiente antes de las 19:00 y vencido después si el README sigue siendo la plantilla", async () => {
    const plantilla = "# Proyecto\n\n## Problema\n<!-- COMPLETAR: qué problema resuelven -->\n\n## Usuario\n<!-- COMPLETAR -->\n";
    const datos = { commits: commitsSanos.slice(0, 1), arbol: arbolCompleto, blobs: { readme: plantilla } };
    const antes = await snapshotRepo(base, clienteSimulado(datos), { ...opts, ahora: ec("2026-11-06T18:00:00") });
    expect(antes.checkpoint1).toBe("pendiente");
    const despues = await snapshotRepo(base, clienteSimulado(datos), { ...opts, ahora: ec("2026-11-06T19:30:00") });
    expect(despues.checkpoint1).toBe("vencido");
    expect(despues.alertas.some((a) => a.tipo === "checkpoint-vencido")).toBe(true);
  });

  it("alertas ámbar: sin commits en 3 h durante la ventana y un solo autor", async () => {
    const commits = [{ sha: "c1", fecha: ec("2026-11-06T16:00:00"), autor: "ana", paths: ["README.md"] }];
    const cliente = clienteSimulado({ commits, arbol: arbolCompleto, blobs: { readme: README_COMPLETO } });
    const s = await snapshotRepo(base, cliente, { ...opts, ahora: ec("2026-11-06T20:30:00") });
    expect(
      s.alertas
        .filter((a) => a.nivel === "ambar")
        .map((a) => a.tipo)
        .sort(),
    ).toEqual(["sin-commits-3h", "un-solo-autor"]);
  });

  it("marca un .env versionado", async () => {
    const arbol = [...arbolCompleto, { path: ".env", tipo: "blob" as const, sha: "env" }];
    const cliente = clienteSimulado({ commits: commitsSanos, arbol, blobs: { readme: README_COMPLETO } });
    const s = await snapshotRepo(base, cliente, { ...opts, ahora: ec("2026-11-07T10:00:00") });
    expect(s.alertas.some((a) => a.tipo === "env-versionado")).toBe(true);
  });
});

describe("resolveDeliveryTag", () => {
  const repo = { owner: "eight-academy-hackathon", name: "edutech26-t3-matricula-express" };

  it("tag antes del freeze: SHA y fecha, sin marcas", async () => {
    const t = await resolveDeliveryTag(repo, clienteSimulado({ tag: { sha: "abc123", fecha: ec("2026-11-07T11:55:00") } }), { freeze: FREEZE });
    expect(t).toEqual({ existe: true, sha: "abc123", commitAt: ec("2026-11-07T11:55:00"), posteriorAlFreeze: false, movido: false });
  });

  it("tag movido tras el freeze a un commit posterior: lo marca", async () => {
    const t = await resolveDeliveryTag(repo, clienteSimulado({ tag: { sha: "def456", fecha: ec("2026-11-07T12:20:00") } }), {
      freeze: FREEZE,
      shaRegistrado: "abc123",
    });
    expect(t.posteriorAlFreeze).toBe(true);
    expect(t.movido).toBe(true);
  });

  it("tag movido a otro commit anterior al freeze: lo detecta comparando con el SHA registrado", async () => {
    const t = await resolveDeliveryTag(repo, clienteSimulado({ tag: { sha: "otro", fecha: ec("2026-11-07T10:00:00") } }), {
      freeze: FREEZE,
      shaRegistrado: "abc123",
    });
    expect(t).toMatchObject({ posteriorAlFreeze: false, movido: true });
  });

  it("sin tag", async () => {
    expect((await resolveDeliveryTag(repo, clienteSimulado({ tag: null }), { freeze: FREEZE })).existe).toBe(false);
  });
});

describe("admisibilidad A1–A5", () => {
  const validacion = {
    chequeos: [
      { id: "organizacion" as const, ok: true, mensaje: "" },
      { id: "existe" as const, ok: true, mensaje: "" },
      { id: "fecha" as const, ok: true, mensaje: "" },
    ],
  };
  const tagOk = { existe: true, sha: "abc", commitAt: ec("2026-11-07T11:50:00"), posteriorAlFreeze: false, movido: false };
  const archivos = { "README.md": true, "PRIOR_WORK.md": true, "AI_USAGE.md": true };

  it("pasa A1, A2, A3 y A5; A4 queda pendiente de la mesa técnica", () => {
    const a = calcularAdmisibilidad({ validacion, tag: tagOk, tagMovidoTrasFreeze: false, archivos, a4: null, declaracionDatosSinteticos: true });
    expect(a).toMatchObject({ a1: true, a2: true, a3: true, a4: null, a5: true, motivos: [] });
  });

  it("A2 falla si el webhook registró un movimiento del tag tras el freeze", () => {
    const a = calcularAdmisibilidad({ validacion, tag: tagOk, tagMovidoTrasFreeze: true, archivos, a4: true, declaracionDatosSinteticos: true });
    expect(a.a2).toBe(false);
    expect(a.motivos[0]).toMatch(/^A2/);
  });

  it("A3 falla sin AI_USAGE.md", () => {
    const a = calcularAdmisibilidad({
      validacion,
      tag: tagOk,
      tagMovidoTrasFreeze: false,
      archivos: { ...archivos, "AI_USAGE.md": false },
      a4: true,
      declaracionDatosSinteticos: true,
    });
    expect(a.a3).toBe(false);
  });
});

describe("webhook de GitHub", () => {
  const secreto = "secreto-webhook";
  const cuerpo = JSON.stringify({ ref: "refs/tags/entrega", created: false, after: "def456", repository: { full_name: "org/repo" } });

  it("verifica X-Hub-Signature-256", () => {
    const firma = `sha256=${createHmac("sha256", secreto).update(cuerpo).digest("hex")}`;
    expect(verificarFirmaGithub(secreto, cuerpo, firma)).toBe(true);
    expect(verificarFirmaGithub(secreto, `${cuerpo} `, firma)).toBe(false);
    expect(verificarFirmaGithub(secreto, cuerpo, null)).toBe(false);
  });

  it("reconoce el movimiento del tag entrega en push y create", () => {
    expect(movimientoDeTag("push", JSON.parse(cuerpo), "entrega")).toEqual({ repo: "org/repo", accion: "movido", sha: "def456" });
    expect(movimientoDeTag("create", { ref: "entrega", ref_type: "tag", repository: { full_name: "org/repo" } }, "entrega")).toMatchObject({
      accion: "creado",
    });
    expect(movimientoDeTag("push", { ref: "refs/heads/main", repository: { full_name: "org/repo" } }, "entrega")).toBeNull();
  });
});

describe("utilidades", () => {
  it("hora de Ecuador como clave", () => {
    expect(horaEcuador(new Date("2026-11-07T02:10:00Z"))).toBe("2026-11-06T21");
  });

  it("el README real de template-repo/ no cumple los checkpoints hasta que el equipo lo completa", () => {
    const plantilla = readFileSync("template-repo/README.md", "utf8");
    expect(readmeCompleto(plantilla, ["problema", "usuario", "evidencia", "arquitectura"])).toBe(false);
    expect(readmeCompleto(plantilla, ["como correrlo"])).toBe(false);
  });

  it("README de plantilla no cuenta como completo", () => {
    expect(readmeCompleto("## Problema\n<!-- COMPLETAR -->", ["problema"])).toBe(false);
    expect(readmeCompleto(README_COMPLETO, ["problema", "usuario", "evidencia", "arquitectura"])).toBe(true);
  });

  it("secretos: .env.example no es alerta, .env sí", () => {
    expect(esArchivoEnv(".env")).toBe(true);
    expect(esArchivoEnv("app/.env.local")).toBe(true);
    expect(esArchivoEnv(".env.example")).toBe(false);
    expect(detectarSecretos(".env.example", "OPENAI_API_KEY=\nSUPABASE_URL=")).toEqual([]);
  });
});
