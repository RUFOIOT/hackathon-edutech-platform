/**
 * npm run n8n:test — aceptación de la Fase 7.
 *
 * 1. Valida los JSON de n8n/workflows/ (conexiones, credenciales por referencia, sin secretos).
 * 2. Levanta un servidor HTTP de prueba que hace de n8n: cada POST /<evento> se pasa por el
 *    workflow importable (el mismo JavaScript de "Verificar firma" que corre en n8n).
 * 3. Envía cada evento con el emitEvent real de la app (lib/n8n.ts) y comprueba que la firma se
 *    acepta, que cuerpos alterados, timestamps viejos y secretos distintos se rechazan con 401, y
 *    que las peticiones de vuelta (n8n → app) llevan una firma que la app acepta.
 * 4. Corre los workflows programados con respuestas simuladas de la app.
 * 5. Opcional: con N8N_TEST_APP_URL y N8N_TEST_APP_SECRET (el N8N_SHARED_SECRET de esa app),
 *    prueba la ida y vuelta contra la app real: consulta firmada → 200, sin firma → 401.
 */
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { cabecerasFirmadas } from "../lib/hmac";
import { TIPOS_EVENTO, crearEvento, emitEvent } from "../lib/n8n";
import { generarCertificado, type DatosCertificado } from "../lib/n8n/certificado";
import {
  ESCENARIOS_PROGRAMADOS,
  EVENTOS_EJEMPLO,
  SECRETO_PRUEBA,
  cargarWorkflows,
  itemWebhook,
  mockApp,
  revisarTraza,
  simular,
  validarWorkflow,
  webhookDe,
  type Traza,
} from "./n8n-simulador";

let fallas = 0;
const comprobar = (cond: boolean, msg: string, detalle = "") => {
  if (!cond) fallas++;
  console.log(`  ${cond ? "✓" : "✗"} ${msg}${!cond && detalle ? ` — ${detalle}` : ""}`);
};

const leer = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let datos = "";
    req.on("data", (c: Buffer) => (datos += c.toString("utf8")));
    req.on("end", () => resolve(datos));
  });

async function main() {
  // WF-09 pide un certificado por integrante; se guardan los pedidos para generar los PDF reales.
  const pedidosCertificado: Record<string, unknown>[] = [];
  const certificado = (c: Record<string, unknown>) => {
    pedidosCertificado.push(c);
    return Buffer.from("%PDF-1.7 simulado");
  };

  console.log("1. Estructura de los workflows");
  const workflows = cargarWorkflows();
  for (const { archivo, wf } of workflows) {
    const errores = validarWorkflow(wf);
    comprobar(errores.length === 0, `${archivo} (${wf.nodes.length} nodos)`, errores.join("; "));
  }
  for (const tipo of TIPOS_EVENTO) comprobar(!!webhookDe(tipo), `webhook para ${tipo}`);

  console.log("\n2. Eventos de la app → servidor de prueba (firma de ida)");
  const trazas = new Map<string, Traza>();
  const servidor = createServer(async (req, res) => {
    const cuerpo = await leer(req);
    const tipo = (req.url ?? "/").slice(1);
    const destino = webhookDe(tipo);
    if (!destino) {
      res.writeHead(404).end();
      return;
    }
    try {
      const cabeceras = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)]));
      const t = await simular(destino.wf, destino.nodo, [itemWebhook(cuerpo, cabeceras)], { mock: mockApp({ certificado }) });
      if (t.respuestas[0] === 200) trazas.set(tipo, t);
      res.writeHead(t.respuestas[0] ?? 500, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: t.respuestas[0] === 200 }));
    } catch (e) {
      res.writeHead(500).end(String((e as Error).message));
    }
  });
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  process.env.N8N_WEBHOOK_BASE_URL = base;
  process.env.N8N_SHARED_SECRET = SECRETO_PRUEBA;

  for (const tipo of TIPOS_EVENTO) {
    const ejemplo = EVENTOS_EJEMPLO[tipo]!;
    const r = await emitEvent(crearEvento(tipo, ejemplo.payload));
    const t = trazas.get(tipo);
    const errores = t ? revisarTraza(t, ejemplo) : ["el workflow no respondió 200"];
    comprobar(r.ok && errores.length === 0, `${tipo}: firma aceptada · ${t?.correos.length ?? 0} correo(s), ${t?.slack.length ?? 0} Slack`, r.ok ? errores.join("; ") : r.error);
    const vuelta = t?.llamadasApp ?? [];
    if (vuelta.length) comprobar(vuelta.every((l) => l.firmaOk), `${tipo}: ${vuelta.length} petición(es) de vuelta a la app con firma válida`);
  }

  // Rechazos.
  const evento = JSON.stringify(crearEvento("announcement.created", EVENTOS_EJEMPLO["announcement.created"]!.payload));
  const enviar = (cuerpo: string, cabeceras: Record<string, string>) =>
    fetch(`${base}/announcement.created`, { method: "POST", headers: { "Content-Type": "application/json", ...cabeceras }, body: cuerpo }).then((r) => r.status);
  comprobar((await enviar(evento.replace("aula 204", "aula 999"), cabecerasFirmadas(SECRETO_PRUEBA, evento))) === 401, "cuerpo alterado → 401");
  comprobar((await enviar(evento, cabecerasFirmadas(SECRETO_PRUEBA, evento, new Date(Date.now() - 6 * 60_000)))) === 401, "timestamp de hace 6 minutos → 401");
  comprobar((await enviar(evento, cabecerasFirmadas("otro-secreto-distinto-0123456789abcdef", evento))) === 401, "secreto distinto → 401");
  comprobar((await enviar(evento, {})) === 401, "sin cabeceras de firma → 401");
  servidor.close();

  console.log("\n3. Certificados (lo que devolvería /api/n8n/certificado)");
  for (const pedido of pedidosCertificado) {
    const datos = pedido as DatosCertificado;
    const pdf = Buffer.from(await generarCertificado(datos));
    comprobar(pdf.subarray(0, 5).toString() === "%PDF-" && pdf.length > 1000, `PDF de ${datos.tipo} para ${datos.nombre} (${Math.round(pdf.length / 1024)} KB)`);
  }

  console.log("\n4. Workflows programados (firma de vuelta n8n → app)");
  const porArchivo = new Map(workflows.map((w) => [w.archivo, w.wf]));
  for (const e of ESCENARIOS_PROGRAMADOS) {
    const t = await simular(porArchivo.get(e.archivo)!, e.disparador, [{ json: {} }], { mock: mockApp() });
    const errores = revisarTraza(t, e);
    comprobar(errores.length === 0, `${e.archivo.slice(0, 5)} · ${e.disparador}: ${t.llamadasApp.length} petición(es) firmadas, ${t.correos.length} correo(s), ${t.slack.length} Slack`, errores.join("; "));
  }

  const app = process.env.N8N_TEST_APP_URL;
  const secretoApp = process.env.N8N_TEST_APP_SECRET;
  if (app && secretoApp) {
    console.log(`\n5. Ida y vuelta contra la app real (${app})`);
    const cuerpo = JSON.stringify({ consulta: "reporte-entregas" });
    const firmada = await fetch(`${app}/api/n8n/consulta`, { method: "POST", headers: { "Content-Type": "application/json", ...cabecerasFirmadas(secretoApp, cuerpo) }, body: cuerpo });
    comprobar(firmada.status === 200, `consulta firmada → ${firmada.status}`);
    const sinFirma = await fetch(`${app}/api/n8n/consulta`, { method: "POST", headers: { "Content-Type": "application/json" }, body: cuerpo });
    comprobar(sinFirma.status === 401, `consulta sin firma → ${sinFirma.status}`);
    const pdf = JSON.stringify({ nombre: "Ana Pérez", equipo: "Los Nodos", tipo: "finalista" });
    const cert = await fetch(`${app}/api/n8n/certificado`, { method: "POST", headers: { "Content-Type": "application/json", ...cabecerasFirmadas(secretoApp, pdf) }, body: pdf });
    comprobar(cert.status === 200 && cert.headers.get("content-type") === "application/pdf", `certificado firmado → ${cert.status} ${cert.headers.get("content-type")}`);
  } else {
    console.log("\n5. Ida y vuelta contra la app real: omitido (define N8N_TEST_APP_URL y N8N_TEST_APP_SECRET)");
  }

  console.log(fallas ? `\n${fallas} comprobación(es) fallaron.` : "\nTodo en orden.");
  process.exit(fallas ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
