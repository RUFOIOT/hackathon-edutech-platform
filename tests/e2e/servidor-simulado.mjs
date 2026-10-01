/**
 * Servidor simulado para los tests e2e (puerto 3999):
 *
 * - POST /n8n/:tipo  → hace de n8n: guarda el evento y verifica la firma HMAC con una
 *   implementación PROPIA (no importa lib/hmac.ts), para probar la ida y vuelta real.
 * - GET  /eventos    → lista los eventos recibidos con `firmaValida`.
 * - GET  /github/users/:usuario → 404 si empieza por "no-existe", 200 en otro caso.
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
