/**
 * Simulador mínimo de n8n para probar los workflows de n8n/workflows/ sin levantar n8n.
 *
 * Ejecuta el JavaScript REAL de los nodos Code (el mismo que se importa en n8n) en un sandbox
 * con $input, $env, $('Nodo'), $getWorkflowStaticData y this.helpers.getBinaryDataBuffer, sigue
 * las conexiones del JSON y simula los nodos IF, Respond to Webhook, Wait, HTTP Request y Slack.
 * Cada llamada a la app se verifica con lib/hmac.ts (firma de vuelta: n8n → app) y responde con
 * un mock; los correos (Resend) y mensajes de Slack se capturan para revisarlos.
 *
 * Lo usan scripts/n8n-test.ts (npm run n8n:test) y tests/unit/n8n.test.ts.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { cabecerasFirmadas, verificarFirma } from "../lib/hmac";

export interface ItemN8n {
  json: Record<string, unknown>;
  binary?: Record<string, Buffer>;
}
interface NodoJson {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  credentials?: Record<string, Record<string, unknown>>;
}
export interface WorkflowJson {
  name: string;
  nodes: NodoJson[];
  connections: Record<string, { main: { node: string }[][] }>;
  settings: Record<string, unknown>;
}
export interface Traza {
  respuestas: number[];
  correos: Record<string, unknown>[];
  slack: string[];
  llamadasApp: { ruta: string; cuerpo: Record<string, unknown>; firmaOk: boolean }[];
}
export type MockApp = (ruta: string, cuerpo: Record<string, unknown>) => Record<string, unknown> | Buffer;

export const SECRETO_PRUEBA = "secreto-de-prueba-n8n-0123456789abcdef";
export const ENV_N8N = {
  EDUTECH_APP_URL: "https://app.edutech.test",
  EDUTECH_SHARED_SECRET: SECRETO_PRUEBA,
  EDUTECH_CORREO_REMITENTE: "Hackathon EduTech <hola@edutech.test>",
  EDUTECH_CORREO_COMITE: "comite@edutech.test",
  EDUTECH_CORREO_MESA_TECNICA: "mesa@edutech.test",
  EDUTECH_SLACK_CANAL_STAFF: "C0STAFF",
};

const DIR = path.join(process.cwd(), "n8n", "workflows");

export function cargarWorkflows(): { archivo: string; wf: WorkflowJson }[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((archivo) => ({ archivo, wf: JSON.parse(readFileSync(path.join(DIR, archivo), "utf8")) as WorkflowJson }));
}

// ---------------------------------------------------------------------------------------------
// Validación estática
// ---------------------------------------------------------------------------------------------

const PATRON_SECRETO = /re_[A-Za-z0-9_]{16,}|xox[abpr]-[A-Za-z0-9-]+|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN|AKIA[0-9A-Z]{16}/;

export function validarWorkflow(wf: WorkflowJson): string[] {
  const errores: string[] = [];
  const nombres = new Set<string>();
  for (const n of wf.nodes) {
    if (nombres.has(n.name)) errores.push(`nodo duplicado: ${n.name}`);
    nombres.add(n.name);
    if (!n.type.startsWith("n8n-nodes-base.")) errores.push(`tipo de nodo no estándar: ${n.type}`);
    for (const [tipo, cred] of Object.entries(n.credentials ?? {})) {
      const claves = Object.keys(cred).sort().join(",");
      if (claves !== "id,name") errores.push(`credencial ${tipo} de "${n.name}" debe ser solo una referencia {id, name}`);
    }
    if (n.type === "n8n-nodes-base.code") {
      try {
        new vm.Script(`(async function() {\n${String(n.parameters.jsCode)}\n})`);
      } catch (e) {
        errores.push(`código inválido en "${n.name}": ${(e as Error).message}`);
      }
    }
  }
  for (const [desde, c] of Object.entries(wf.connections)) {
    if (!nombres.has(desde)) errores.push(`conexión desde un nodo inexistente: ${desde}`);
    for (const salida of c.main) for (const destino of salida) if (!nombres.has(destino.node)) errores.push(`conexión hacia un nodo inexistente: ${destino.node}`);
  }
  const anteriores = (nombre: string) => Object.entries(wf.connections).filter(([, c]) => c.main.some((s) => s.some((d) => d.node === nombre))).map(([k]) => k);
  for (const n of wf.nodes) {
    if (n.type === "n8n-nodes-base.webhook" && !wf.connections[n.name]?.main[0]?.some((d) => d.node === "Verificar firma"))
      errores.push(`el webhook "${n.name}" no pasa por "Verificar firma"`);
    if (n.type === "n8n-nodes-base.httpRequest" && String(n.parameters.url).includes("EDUTECH_APP_URL") && !anteriores(n.name).every((a) => a.startsWith("Firmar")))
      errores.push(`"${n.name}" llama a la app sin pasar por un nodo "Firmar …"`);
  }
  if (wf.settings.timezone !== "America/Guayaquil") errores.push("la zona horaria debe ser America/Guayaquil");
  if (wf.settings.saveDataSuccessExecution !== "none") errores.push("no debe guardar ejecuciones exitosas (contienen datos personales)");
  if (PATRON_SECRETO.test(JSON.stringify(wf))) errores.push("contiene algo que parece un secreto");
  return errores;
}

// ---------------------------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------------------------

const requerir = createRequire(import.meta.url);

export async function ejecutarCodigo(
  jsCode: string,
  opts: { entrada: ItemN8n[]; env?: Record<string, string>; nodos?: Record<string, ItemN8n[]>; estatico?: Record<string, unknown> },
): Promise<ItemN8n[]> {
  const contexto = {
    $env: opts.env ?? ENV_N8N,
    $input: { first: () => opts.entrada[0], all: () => opts.entrada },
    $: (nombre: string) => {
      const items = opts.nodos?.[nombre];
      if (!items) throw new Error(`El nodo "${nombre}" no se ha ejecutado`);
      return { first: () => items[0], all: () => items };
    },
    $getWorkflowStaticData: () => opts.estatico ?? {},
    require: requerir,
    Buffer,
  };
  const fn = vm.runInNewContext(`(async function() {\n${jsCode}\n})`, contexto) as () => Promise<ItemN8n[]>;
  const helpers = {
    getBinaryDataBuffer: async (i: number, prop: string) => {
      const b = opts.entrada[i]?.binary?.[prop];
      if (!b) throw new Error("sin datos binarios");
      return b;
    },
  };
  // Los objetos creados en el sandbox se copian para compararlos con los del proceso.
  const salida = await fn.call({ helpers });
  return salida.map((i) => ({ json: JSON.parse(JSON.stringify(i.json)) as Record<string, unknown>, ...(i.binary ? { binary: i.binary } : {}) }));
}

/** Evalúa las condiciones IF que generan los workflows: `={{ $json.campo }}` contra un valor. */
function cumpleSi(nodo: NodoJson, item: ItemN8n): boolean {
  const cond = (nodo.parameters.conditions as { conditions: { leftValue: string; rightValue: unknown; operator: { type: string; operation: string } }[] }).conditions[0]!;
  const campo = /\$json\.(\w+)/.exec(cond.leftValue)?.[1];
  const valor = campo ? item.json[campo] : undefined;
  if (cond.operator.type === "boolean" && cond.operator.operation === "true") return valor === true;
  if (cond.operator.type === "string" && cond.operator.operation === "equals") return valor === cond.rightValue;
  throw new Error(`Condición IF no soportada en "${nodo.name}"`);
}

export async function simular(
  wf: WorkflowJson,
  inicio: string,
  entrada: ItemN8n[],
  opts: { mock: MockApp; estatico?: Record<string, unknown>; secreto?: string },
): Promise<Traza> {
  const traza: Traza = { respuestas: [], correos: [], slack: [], llamadasApp: [] };
  const salidas: Record<string, ItemN8n[]> = {};
  const porNombre = new Map(wf.nodes.map((n) => [n.name, n]));
  const pila: { nodo: string; items: ItemN8n[] }[] = [{ nodo: inicio, items: entrada }];
  let pasos = 0;

  while (pila.length) {
    if (++pasos > 500) throw new Error("Demasiados pasos: ¿hay un ciclo?");
    const { nodo: nombre, items } = pila.shift()!;
    if (!items.length) continue;
    const nodo = porNombre.get(nombre);
    if (!nodo) throw new Error(`Nodo inexistente: ${nombre}`);
    let porSalida: ItemN8n[][] = [items];

    switch (nodo.type) {
      case "n8n-nodes-base.webhook":
      case "n8n-nodes-base.scheduleTrigger":
      case "n8n-nodes-base.errorTrigger":
      case "n8n-nodes-base.wait":
        break;
      case "n8n-nodes-base.code":
        porSalida = [await ejecutarCodigo(String(nodo.parameters.jsCode), { entrada: items, nodos: salidas, estatico: opts.estatico })];
        break;
      case "n8n-nodes-base.if":
        porSalida = [items.filter((i) => cumpleSi(nodo, i)), items.filter((i) => !cumpleSi(nodo, i))];
        break;
      case "n8n-nodes-base.respondToWebhook":
        traza.respuestas.push(Number((nodo.parameters.options as { responseCode?: number }).responseCode ?? 200));
        break;
      case "n8n-nodes-base.slack":
        traza.slack.push(...items.map((i) => String(i.json.mensaje)));
        break;
      case "n8n-nodes-base.httpRequest": {
        const url = String(nodo.parameters.url);
        if (url.includes("api.resend.com")) {
          traza.correos.push(...items.map((i) => i.json));
          porSalida = [items.map(() => ({ json: { id: "correo-simulado" } }))];
          break;
        }
        const ruta = url.replace("={{ $env.EDUTECH_APP_URL }}", "");
        porSalida = [
          items.map((i) => {
            const cuerpo = String(i.json.cuerpo);
            const firma = verificarFirma({ secreto: opts.secreto ?? SECRETO_PRUEBA, cuerpo, timestamp: String(i.json.ts), firma: String(i.json.firma) });
            const datos = JSON.parse(cuerpo) as Record<string, unknown>;
            traza.llamadasApp.push({ ruta, cuerpo: datos, firmaOk: firma.ok });
            if (!firma.ok) throw new Error(`Firma rechazada por la app en ${ruta}: ${firma.motivo}`);
            const r = opts.mock(ruta, datos);
            return Buffer.isBuffer(r) ? { json: {}, binary: { data: r } } : { json: r };
          }),
        ];
        break;
      }
      default:
        throw new Error(`Tipo de nodo no simulado: ${nodo.type}`);
    }

    salidas[nombre] = porSalida.flat();
    (wf.connections[nombre]?.main ?? []).forEach((destinos, i) => {
      for (const d of destinos) pila.push({ nodo: d.node, items: porSalida[i] ?? [] });
    });
  }
  return traza;
}

/** Ítem que produce el nodo Webhook de n8n (Raw Body activado) para una petición. */
export function itemWebhook(cuerpo: string, cabeceras: Record<string, string>): ItemN8n {
  const headers = Object.fromEntries(Object.entries(cabeceras).map(([k, v]) => [k.toLowerCase(), v]));
  return { json: { headers, body: JSON.parse(cuerpo) as unknown as Record<string, unknown> }, binary: { data: Buffer.from(cuerpo, "utf8") } };
}

export function webhookDe(tipo: string): { wf: WorkflowJson; nodo: string } | null {
  for (const { wf } of cargarWorkflows()) {
    const n = wf.nodes.find((x) => x.type === "n8n-nodes-base.webhook" && x.parameters.path === tipo);
    if (n) return { wf, nodo: n.name };
  }
  return null;
}

/** Firma un cuerpo como lo hace la app (para pruebas sin HTTP). */
export function firmarComoApp(cuerpo: string, secreto = SECRETO_PRUEBA, ahora?: Date) {
  return cabecerasFirmadas(secreto, cuerpo, ahora);
}

// ---------------------------------------------------------------------------------------------
// Escenarios
// ---------------------------------------------------------------------------------------------

const XSS = "<script>alert(1)</script>";
const pdfFalso = Buffer.from("%PDF-1.7 simulado");

/** Payloads de ejemplo por evento y lo que cada workflow debe producir. */
export const EVENTOS_EJEMPLO: Record<string, { payload: Record<string, unknown>; correos: number; slack: number }> = {
  "registration.created": {
    payload: { participantId: "p-1", nombres: "Ana", email: "ana@edutech.test", categoria: "JUNIOR", modo: "equipo", teamId: "los-nodos", teamNombre: `Los Nodos ${XSS}`, codigoInvitacion: "ABC234", listaEspera: false, requiereAutorizacion: true },
    correos: 1,
    slack: 1,
  },
  "team.invitation": {
    payload: { teamId: "los-nodos", teamNombre: `Los Nodos ${XSS}`, track: "T1", correo: "luis@edutech.test", codigo: "ABC234", enlace: "https://app.edutech.test/registro?codigo=ABC234", invitadoPor: "Ana Pérez" },
    correos: 1,
    slack: 0,
  },
  "team.completed": { payload: { teamId: "los-nodos", teamNombre: "Los Nodos", miembros: 2 }, correos: 0, slack: 1 },
  "guardian.validated": { payload: { participantId: "p-1", nombres: "Ana", email: "ana@edutech.test", decision: "rechazado" }, correos: 1, slack: 0 },
  "checkin.created": { payload: { participantId: "p-1", teamId: "los-nodos", dia: "viernes", categoria: "JUNIOR" }, correos: 0, slack: 1 },
  "mentor.requested": { payload: { requestId: "los-nodos_n8n_1", teamId: "los-nodos", teamNombre: "Los Nodos", tema: "n8n", detalle: XSS }, correos: 2, slack: 2 },
  "submission.created": {
    payload: {
      teamId: "los-nodos",
      teamNombre: "Los Nodos",
      track: "T1",
      repoUrl: "https://github.com/eight-academy-hackathon/edutech-2026-t1-los-nodos",
      tagSha: "abcdef1234567890",
      tagCommitAt: "2026-11-07T16:40:00.000Z",
      demoUrl: "https://demo.edutech.test",
      destinatarios: ["ana@edutech.test", "luis@edutech.test"],
      reenvio: false,
    },
    correos: 2,
    slack: 1,
  },
  "announcement.created": {
    payload: { id: "a1", alcance: { tipo: "track", track: "T1" }, mensaje: `La sala 2 cambia al aula 204.\n\n${XSS}`, destinatarios: ["ana@edutech.test", "luis@edutech.test"] },
    correos: 2,
    slack: 1,
  },
  "results.published": {
    payload: {
      equipos: [
        {
          teamId: "los-nodos",
          nombre: "Los Nodos",
          finalista: true,
          posicionFinal: 1,
          premios: ["1er lugar general"],
          integrantes: [
            { nombre: "Ana Pérez", email: "ana@edutech.test" },
            { nombre: "Sin Correo", email: null },
          ],
        },
        { teamId: "otro", nombre: "Otro", finalista: false, posicionFinal: null, premios: [], integrantes: [{ nombre: "Luis", email: "luis@edutech.test" }] },
      ],
    },
    correos: 2,
    slack: 1,
  },
};

/** Respuestas simuladas de la app. `certificado` permite usar el PDF real en npm run n8n:test. */
export function mockApp(opts: { certificado?: (cuerpo: Record<string, unknown>) => Buffer } = {}): MockApp {
  return (ruta, cuerpo) => {
    if (ruta === "/api/n8n/certificado") return opts.certificado ? opts.certificado(cuerpo) : pdfFalso;
    if (ruta === "/api/eventos/reintentar") return { enviados: 3, pendientes: 1, fallidos: 2 };
    if (ruta === "/api/github/snapshot")
      return {
        resultados: [
          { teamId: "los-nodos", ok: true, alertasRojas: ["Posible secreto en src/config.js"], alertasAmbar: [] },
          { teamId: "otro", ok: false, error: "No se pudo leer el repositorio" },
        ],
      };
    switch (cuerpo.consulta) {
      case "recordatorios-convocatoria":
        return {
          activo: true,
          cierre: "2026-10-30T23:59:00-05:00",
          autorizacionesPendientes: [{ nombres: "Ana", para: ["ana@edutech.test", "mama@edutech.test"], archivoSubido: false, enlace: "https://app.edutech.test/mi-equipo" }],
          equiposIncompletos: [{ teamNombre: "Los Nodos", miembros: 1, codigo: "ABC234", enlace: "https://app.edutech.test/registro?codigo=ABC234", para: ["ana@edutech.test"] }],
          webinar: { fecha: "2026-10-28T18:00:00-05:00", para: ["ana@edutech.test"] },
        };
      case "checkpoints-en-riesgo":
        return {
          hito: cuerpo.hito,
          limite: "2026-11-07T15:30:00.000Z",
          enRiesgo: [{ teamNombre: "Los Nodos", motivo: "Aún no hay una demo funcional mínima ejecutable.", para: ["ana@edutech.test", "luis@edutech.test"], enlace: "https://app.edutech.test/mi-equipo/repositorio" }],
        };
      case "reporte-entregas":
        return {
          total: 2,
          entregados: 1,
          admisibles: 1,
          equipos: [
            { teamNombre: "Los Nodos", track: "T1", entregado: true, tagMovidoTrasFreeze: false, fallas: [], a4Pendiente: true },
            { teamNombre: `Otro ${XSS}`, track: "T2", entregado: false, tagMovidoTrasFreeze: false, fallas: ["A3"], a4Pendiente: false },
          ],
          enlace: "https://app.edutech.test/admin/repositorios",
        };
      case "mentores":
        return { tema: cuerpo.tema, para: ["mentor@edutech.test"], enlace: "https://app.edutech.test/admin/mentoria" };
      case "mentoria-estado":
        return { existe: true, estado: "abierta", tema: "n8n", minutosEspera: 31, enlace: "https://app.edutech.test/admin/mentoria" };
      case "retroalimentacion":
        return { publicado: true, fortalezas: ["Demo en vivo sólida"], recomendaciones: [`Medir el impacto ${XSS}`], enlace: "https://app.edutech.test/mi-equipo/resultado" };
      default:
        throw new Error(`Consulta no simulada: ${String(cuerpo.consulta)}`);
    }
  };
}

/** Escenarios de los workflows programados: archivo, nodo disparador y lo esperado. */
export const ESCENARIOS_PROGRAMADOS: { archivo: string; disparador: string; correos: number; slack: number; consulta?: Record<string, unknown> }[] = [
  { archivo: "WF-00-reintento-eventos.json", disparador: "Cada 5 minutos", correos: 0, slack: 1 },
  { archivo: "WF-03-recordatorios-convocatoria.json", disparador: "Cada día a las 09:00", correos: 4, slack: 1, consulta: { consulta: "recordatorios-convocatoria" } },
  { archivo: "WF-04-monitor-repositorios.json", disparador: "Cada 15 min en la ventana", correos: 1, slack: 1 },
  { archivo: "WF-05-recordatorio-checkpoints.json", disparador: "Viernes 18:30 (checkpoint 1)", correos: 2, slack: 1, consulta: { consulta: "checkpoints-en-riesgo", hito: "checkpoint1" } },
  { archivo: "WF-05-recordatorio-checkpoints.json", disparador: "Sábado 10:00 (checkpoint 2)", correos: 2, slack: 1, consulta: { consulta: "checkpoints-en-riesgo", hito: "checkpoint2" } },
  { archivo: "WF-05-recordatorio-checkpoints.json", disparador: "Sábado 11:30 (code freeze)", correos: 2, slack: 1, consulta: { consulta: "checkpoints-en-riesgo", hito: "freeze" } },
  { archivo: "WF-06-validacion-entregas.json", disparador: "Sábado 12:05", correos: 1, slack: 1, consulta: { consulta: "reporte-entregas" } },
];

/** Ejecución fallida de ejemplo, con la forma que entrega el Error Trigger de n8n. */
export const ERROR_EJEMPLO = {
  execution: { id: "231", url: "https://n8n.ejemplo/execution/231", lastNodeExecuted: "Enviar correo (Resend)", error: { message: "401 Unauthorized" } },
  workflow: { id: "7", name: "WF-01 · Confirmación de inscripción" },
};

/** Revisa una traza: cantidades esperadas, firmas aceptadas y HTML sin inyección. */
export function revisarTraza(t: Traza, esperado: { correos: number; slack: number }): string[] {
  const errores: string[] = [];
  if (t.correos.length !== esperado.correos) errores.push(`se esperaban ${esperado.correos} correos y salieron ${t.correos.length}`);
  if (t.slack.length !== esperado.slack) errores.push(`se esperaban ${esperado.slack} mensajes de Slack y salieron ${t.slack.length}`);
  for (const c of t.correos) {
    const para = c.para as string[];
    if (!Array.isArray(para) || para.length !== 1) errores.push(`cada correo debe ir a una sola persona (para: ${JSON.stringify(para)})`);
    if (!c.asunto || !c.html || !c.texto) errores.push("correo sin asunto, HTML o texto plano");
    if (String(c.html).includes("<script")) errores.push("el HTML del correo no escapa el contenido (<script>)");
  }
  if (t.llamadasApp.some((l) => !l.firmaOk)) errores.push("alguna petición a la app no pasó la verificación de firma");
  return errores;
}
