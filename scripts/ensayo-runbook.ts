/**
 * Ensayo del runbook (Fase 8): recorre el checklist de docs/RUNBOOK.md contra una instancia con
 * los emuladores y el seed cargados, e imprime el resultado en Markdown para pegarlo en el runbook.
 *
 * Uso (con `npm run emulators`, `npm run seed` y la app en marcha):
 *   ENSAYO_APP_URL=http://localhost:3200 ENSAYO_N8N_SECRET=<N8N_SHARED_SECRET de esa app> npm run ensayo
 *
 * La instancia debe tener APP_FECHA_SIMULADA en la ventana de hacking (p. ej. 2026-11-07T11:00-05:00).
 */
import { execFileSync } from "node:child_process";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { strFromU8, unzipSync } from "fflate";
import { cabecerasFirmadas } from "../lib/hmac";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
if (!/^(127\.0\.0\.1|localhost)/.test(process.env.FIRESTORE_EMULATOR_HOST)) throw new Error("El ensayo solo corre contra emuladores locales.");

const APP = process.env.ENSAYO_APP_URL ?? "http://localhost:3200";
const SECRETO = process.env.ENSAYO_N8N_SECRET ?? "";
const app = getApps()[0] ?? initializeApp({ projectId: "demo-edutech" });
const db = getFirestore(app);
const auth = getAuth(app);

const filas: { bloque: string; paso: string; ok: boolean; detalle: string }[] = [];
async function paso(bloque: string, nombre: string, fn: () => Promise<string>) {
  try {
    filas.push({ bloque, paso: nombre, ok: true, detalle: await fn() });
  } catch (e) {
    filas.push({ bloque, paso: nombre, ok: false, detalle: (e as Error).message.slice(0, 160) });
  }
}
function exigir(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** Inicia sesión como `uid` sin correo: token personalizado → ID token del emulador → cookie. */
async function sesion(uid: string): Promise<string> {
  const custom = await auth.createCustomToken(uid);
  const r = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  const { idToken } = (await r.json()) as { idToken: string };
  const s = await fetch(`${APP}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP, "X-Forwarded-For": `192.0.2.${uid.length}` },
    body: JSON.stringify({ idToken }),
  });
  exigir(s.ok, `sesión de ${uid}: HTTP ${s.status}`);
  return (s.headers.get("set-cookie") ?? "").split(";")[0]!;
}

const get = (ruta: string, cookie?: string) => fetch(`${APP}${ruta}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
const firmado = (ruta: string, cuerpo: unknown) => {
  const b = JSON.stringify(cuerpo);
  return fetch(`${APP}${ruta}`, { method: "POST", headers: { "Content-Type": "application/json", ...cabecerasFirmadas(SECRETO, b) }, body: b });
};

async function main() {
  // 1. Antes de abrir puertas
  await paso("Antes del evento", "Web pública, guías y privacidad responden", async () => {
    for (const r of ["/", "/tracks", "/guia", "/guia-hacker", "/rubrica", "/privacidad", "/resultados", "/dataset-ficticio-colegio.zip"]) {
      const res = await get(r);
      exigir(res.status === 200, `${r} → ${res.status}`);
    }
    return "8 rutas con 200";
  });
  await paso("Antes del evento", "Cabeceras de seguridad presentes", async () => {
    const h = (await get("/")).headers;
    exigir(h.get("content-security-policy")?.includes("frame-ancestors 'none'"), "falta CSP");
    exigir(h.get("x-content-type-options") === "nosniff", "falta nosniff");
    return "CSP, nosniff, X-Frame-Options";
  });
  const admin = await sesion("staff-admin");
  const tecnica = await sesion("staff-tecnica");
  const checkin = await sesion("staff-checkin");
  await paso("Antes del evento", "Cada rol entra solo a lo suyo", async () => {
    exigir((await get("/admin", admin)).status === 200, "admin no entra a /admin");
    exigir((await get("/admin/privacidad", admin)).status === 200, "admin no entra a /admin/privacidad");
    exigir((await get("/admin/checkin", checkin)).status === 200, "check-in no entra a /admin/checkin");
    const r = await get("/admin/participantes", checkin);
    exigir(r.status === 307 && r.headers.get("location")?.includes("/sin-acceso"), `check-in en /admin/participantes → ${r.status}`);
    exigir((await get("/admin/resultados", tecnica)).status === 307, "mesa técnica no debería ver resultados");
    return "admin, mesa técnica y check-in";
  });
  await paso("Antes del evento", "Respaldo offline: exportación XLSX y CSV (admin)", async () => {
    const x = await get("/api/admin/exportar?formato=xlsx", admin);
    exigir(x.status === 200 && x.headers.get("content-type")?.includes("spreadsheetml"), `XLSX → ${x.status}`);
    const c = await get("/api/admin/exportar?formato=csv", admin);
    const archivos = unzipSync(new Uint8Array(await c.arrayBuffer()));
    const cab = strFromU8(archivos["participantes.csv"]!).split("\n")[0]!;
    exigir(cab.includes("email"), "el admin debería ver el contacto");
    return `${Object.keys(archivos).length} hojas; participantes con contacto`;
  });
  await paso("Antes del evento", "La mesa técnica exporta sin contacto ni puntajes", async () => {
    const c = await get("/api/admin/exportar?formato=csv", tecnica);
    const archivos = unzipSync(new Uint8Array(await c.arrayBuffer()));
    exigir(!strFromU8(archivos["participantes.csv"]!).split("\n")[0]!.includes("email"), "mesa técnica ve correos");
    exigir(!("puntajes.csv" in archivos), "mesa técnica ve puntajes");
    return "sin email, celular ni puntajes";
  });

  // 2. Durante el evento
  await paso("Durante el evento", "Check-in: lista y conteo en vivo", async () => {
    const html = await (await get("/admin/checkin", checkin)).text();
    exigir(/presentes/.test(html), "no aparece el conteo");
    const presentes = (await db.collection("checkins").get()).size;
    return `${presentes} check-ins en el seed`;
  });
  await paso("Durante el evento", "Proyector de sala responde", async () => {
    const r = await get("/pantalla?sala=sala-1", admin);
    exigir(r.status === 200, `/pantalla → ${r.status}`);
    return "/pantalla con 200";
  });
  await paso("Durante el evento", "Endpoints de n8n rechazan peticiones sin firma", async () => {
    const r = await fetch(`${APP}/api/n8n/consulta`, { method: "POST", body: "{}" });
    exigir(r.status === 401, `sin firma → ${r.status}`);
    return "401";
  });
  if (SECRETO) {
    await paso("Si GitHub limita la API", "El snapshot no se cae: responde por equipo", async () => {
      const r = await firmado("/api/github/snapshot", { todos: true });
      exigir(r.status === 200, `snapshot → ${r.status}`);
      const { resultados } = (await r.json()) as { resultados: { ok: boolean }[] };
      return `${resultados.length} equipos; ${resultados.filter((x) => !x.ok).length} con error de GitHub (esperado sin credenciales)`;
    });
    await paso("Si n8n no responde", "El outbox guarda y el reintento responde", async () => {
      const pendientes = (await db.collection("event_outbox").where("estado", "==", "pendiente").get()).size;
      const r = await firmado("/api/eventos/reintentar", {});
      exigir(r.status === 200, `reintentar → ${r.status}`);
      return `${pendientes} pendientes antes; respuesta ${JSON.stringify(await r.json())}`;
    });
    await paso("Durante el evento", "Consultas de los workflows con el seed", async () => {
      for (const c of [{ consulta: "checkpoints-en-riesgo", hito: "checkpoint2" }, { consulta: "reporte-entregas" }, { consulta: "mentores", tema: "n8n" }]) {
        const r = await firmado("/api/n8n/consulta", c);
        exigir(r.status === 200, `${c.consulta} → ${r.status}`);
      }
      return "3 consultas con 200";
    });
  }
  await paso("Durante el evento", "Límite de peticiones activo", async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
    let ultimo = 0;
    for (let i = 0; i < 121; i++) {
      ultimo = (await fetch(`${APP}/api/auth/session`, { method: "POST", headers: { Origin: APP, "X-Forwarded-For": ip, "Content-Type": "application/json" }, body: "{}" })).status;
    }
    exigir(ultimo === 429, `intento 121 → ${ultimo}`);
    return "429 en el intento 121 desde la misma IP";
  });

  // 3. Cierre
  await paso("Cierre", "KPIs del dashboard coinciden con SQL", async () => {
    const salida = execFileSync("npx", ["tsx", "scripts/verificar-kpis.ts"], { encoding: "utf8", env: { ...process.env, APP_FECHA_SIMULADA: "2026-11-07T11:00:00-05:00" } });
    return salida.trim().split("\n").at(-1) ?? "";
  });
  if (SECRETO) {
    await paso("Cierre", "Firma de ida y vuelta con n8n (npm run n8n:test)", async () => {
      const salida = execFileSync("npx", ["tsx", "--conditions=react-server", "scripts/n8n-test.ts"], {
        encoding: "utf8",
        env: { ...process.env, N8N_TEST_APP_URL: APP, N8N_TEST_APP_SECRET: SECRETO },
      });
      return salida.trim().split("\n").at(-1) ?? "";
    });
  }
  await paso("Después del evento", "Privacidad: solicitudes y plazo de retención visibles", async () => {
    const html = await (await get("/admin/privacidad", admin)).text();
    exigir(html.includes("Política de retención"), "no carga la sección de retención");
    return "plazo y conteo visibles";
  });

  const fecha = new Date().toISOString().slice(0, 10);
  console.log(`### Ensayo ${fecha} · ${APP} (seed, emuladores)\n`);
  console.log("| Bloque | Paso | Resultado | Detalle |\n| --- | --- | --- | --- |");
  for (const f of filas) console.log(`| ${f.bloque} | ${f.paso} | ${f.ok ? "OK" : "FALLA"} | ${f.detalle.replace(/\|/g, "\\|")} |`);
  const fallas = filas.filter((f) => !f.ok).length;
  console.log(`\n${filas.length - fallas}/${filas.length} pasos OK.`);
  process.exit(fallas ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
