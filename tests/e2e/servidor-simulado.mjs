/**
 * Servidor simulado para los tests e2e (puerto 3999):
 *
 * - POST /n8n/:tipo  → hace de n8n: guarda el evento y verifica la firma HMAC con una
 *   implementación PROPIA (no importa lib/hmac.ts), para probar la ida y vuelta real.
 * - GET  /eventos    → lista los eventos recibidos con `firmaValida`.
 * - GET  /github/users/:usuario → 404 si empieza por "no-existe", 200 en otro caso.
 * - GET  /github/repos/... → repositorio simulado de un equipo (lo que lee Octokit en lib/github):
 *   creado después del kick-off, 4 commits de 2 autores, árbol completo, tag `entrega` a las 11:50.
 *   Variantes por nombre: "-inexistente" → 404; "-sin-tag" → sin tag de entrega.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const SECRETO = process.env.N8N_SHARED_SECRET ?? "";
const PUERTO = Number(process.env.PUERTO_SIMULADO ?? 3999);
const eventos = [];

function firmaValida(timestamp, firma, cuerpo) {
  if (!timestamp || !firma || !SECRETO) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const esperada = Buffer.from(`sha256=${createHmac("sha256", SECRETO).update(`${timestamp}.${cuerpo}`).digest("hex")}`);
  const dada = Buffer.from(firma);
  return esperada.length === dada.length && timingSafeEqual(esperada, dada);
}

// ---------- Repositorio simulado ----------
const README = `# Proyecto de prueba

## Problema
Las matrículas toman tres días de filas en la secretaría y las familias pierden jornadas de trabajo.

## Usuario
Secretaria académica (EST-014) y familias de primer año; entrevistamos a dos secretarias y tres madres.

## Evidencia de la entrevista
EST-014 dijo que el 60 % del tiempo se va en transcribir formularios en papel al sistema académico.

## Arquitectura
Formulario web, flujo n8n que valida documentos y escribe en una hoja de cálculo, correo de confirmación.

## Cómo correrlo
npm install, copiar .env.example a .env y ejecutar npm run dev; importar n8n/flujo.json en n8n.
`;
const BLOBS = { readme: README, prior: "# Trabajo previo\nNinguno.", ai: "# Uso de IA\nClaude para revisar código.", src: "export const ok = true;\n" };
const ARBOL = [
  ["README.md", "blob", "readme"], ["PRIOR_WORK.md", "blob", "prior"], ["AI_USAGE.md", "blob", "ai"], ["LICENSE", "blob", "lic"],
  [".env.example", "blob", "envex"], ["docs", "tree", "docs"], ["docs/arquitectura.png", "blob", "png"], ["n8n", "tree", "n8n"],
  ["n8n/flujo.json", "blob", "flujo"], ["data", "tree", "data"], ["data/README.md", "blob", "datareadme"], ["src", "tree", "srcdir"], ["src/index.ts", "blob", "src"],
].map(([path, type, sha]) => ({ path, type, sha, size: 100 }));
const COMMITS = [
  ["c1", "2026-11-06T21:05:00Z", "ana-e2e", ["README.md"]],
  ["c2", "2026-11-06T23:40:00Z", "luis-e2e", ["README.md"]],
  ["c3", "2026-11-07T14:10:00Z", "ana-e2e", ["src/index.ts"]],
  ["c4", "2026-11-07T15:20:00Z", "luis-e2e", ["src/index.ts"]],
];
const SHA_ENTREGA = "e2e0c0ffee1234567890abcdef1234567890abcd";

function responderRepo(owner, name, resto, url, json) {
  if (name.endsWith("-inexistente")) return json(404, { message: "Not Found" });
  if (resto === "") {
    return json(200, { name, owner: { login: owner }, created_at: "2026-11-06T21:00:00Z", default_branch: "main", private: true });
  }
  if (resto === "/commits") {
    const since = url.searchParams.get("since"), until = url.searchParams.get("until"), path = url.searchParams.get("path");
    const t = (x) => Date.parse(x);
    const lista = COMMITS.filter(
      ([, f, , paths]) => (!since || t(f) >= t(since)) && (!until || t(f) <= t(until)) && (!path || paths.some((p) => p.startsWith(path))),
    );
    return json(200, lista.map(([sha, fecha, login]) => ({ sha, author: { login }, commit: { author: { name: login, date: fecha }, committer: { date: fecha } } })));
  }
  if (resto.startsWith("/git/trees/")) return json(200, { tree: ARBOL, truncated: false });
  const blob = /^\/git\/blobs\/(.+)$/.exec(resto);
  if (blob) return json(200, { encoding: "base64", content: Buffer.from(BLOBS[blob[1]] ?? "").toString("base64") });
  if (resto === "/git/ref/tags/entrega") {
    return name.endsWith("-sin-tag") ? json(404, { message: "Not Found" }) : json(200, { ref: "refs/tags/entrega", object: { sha: SHA_ENTREGA, type: "commit" } });
  }
  if (resto.startsWith("/git/commits/")) return json(200, { sha: SHA_ENTREGA, committer: { date: "2026-11-07T16:50:00Z" } });
  return json(404, { message: "Not Found" });
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PUERTO}`);
  const json = (code, data) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  if (req.method === "GET" && url.pathname === "/") return json(200, { ok: true });
  if (req.method === "GET" && url.pathname === "/eventos") return json(200, eventos);

  const gh = /^\/github\/users\/([^/]+)$/.exec(url.pathname);
  if (req.method === "GET" && gh) {
    const usuario = decodeURIComponent(gh[1]);
    return usuario.startsWith("no-existe") ? json(404, { message: "Not Found" }) : json(200, { login: usuario });
  }

  const repo = /^\/github\/repos\/([^/]+)\/([^/]+)(\/.*)?$/.exec(decodeURIComponent(url.pathname));
  if (req.method === "GET" && repo) return responderRepo(repo[1], repo[2], repo[3] ?? "", url, json);

  const n8n = /^\/n8n\/([\w.]+)$/.exec(url.pathname);
  if (req.method === "POST" && n8n) {
    let cuerpo = "";
    req.on("data", (c) => (cuerpo += c));
    req.on("end", () => {
      const valida = firmaValida(req.headers["x-timestamp"], req.headers["x-signature"], cuerpo);
      let datos = null;
      try {
        datos = JSON.parse(cuerpo);
      } catch {
        /* cuerpo inválido: se registra igual */
      }
      eventos.push({ ruta: n8n[1], firmaValida: valida, evento: datos });
      json(valida ? 200 : 401, { ok: valida });
    });
    return;
  }
  json(404, { error: "no encontrado" });
}).listen(PUERTO, "127.0.0.1", () => console.log(`Servidor simulado en :${PUERTO}`));
