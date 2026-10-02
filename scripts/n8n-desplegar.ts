/**
 * Despliega los workflows de n8n/workflows/ en una instancia de n8n (pensado para n8n Cloud):
 * `npm run n8n:desplegar`.
 *
 * n8n Cloud no permite variables de entorno en los nodos, así que este script inyecta la
 * configuración (URL de la app, secreto HMAC, correos) en cada workflow al subirlo; el repositorio
 * sigue sin secretos. Además adapta los canales a lo disponible en Cloud:
 *   - avisos al staff: Slack → Telegram (como la plantilla 2159 de n8n);
 *   - correo: Resend → Gmail (credencial OAuth creada en la interfaz de n8n).
 * Crea o actualiza cada workflow por nombre, enlaza WF-99 como "Error workflow" y los activa.
 *
 * Configuración en .env.n8n (no se sube al repositorio, ver n8n/README.md):
 *   N8N_API_URL, N8N_API_KEY, EDUTECH_APP_URL, EDUTECH_SHARED_SECRET,
 *   EDUTECH_CORREO_COMITE, EDUTECH_CORREO_MESA_TECNICA, TELEGRAM_CHAT_ID (opcional),
 *   TELEGRAM_BOT_TOKEN (opcional: crea la credencial) o TELEGRAM_CREDENCIAL_ID,
 *   GMAIL_CREDENCIAL_ID (opcional: si falta, se elige en la interfaz)
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cargarWorkflows, validarWorkflow, type WorkflowJson } from "./n8n-simulador";

// Carga .env.n8n sin dependencias.
const archivoEnv = path.join(process.cwd(), ".env.n8n");
if (existsSync(archivoEnv)) {
  for (const linea of readFileSync(archivoEnv, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (m && !linea.trimStart().startsWith("#")) process.env[m[1]!] ??= m[2]!.replace(/^["']|["']$/g, "");
  }
}

const requerida = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Falta ${k} en .env.n8n (ver n8n/README.md).`);
  return v;
};
const API = `${requerida("N8N_API_URL").replace(/\/$/, "")}/api/v1`;
const CLAVE = requerida("N8N_API_KEY");
const CONFIG: Record<string, string> = {
  EDUTECH_APP_URL: requerida("EDUTECH_APP_URL").replace(/\/$/, ""),
  EDUTECH_SHARED_SECRET: requerida("EDUTECH_SHARED_SECRET"),
  EDUTECH_CORREO_COMITE: requerida("EDUTECH_CORREO_COMITE"),
  EDUTECH_CORREO_MESA_TECNICA: requerida("EDUTECH_CORREO_MESA_TECNICA"),
  EDUTECH_CORREO_REMITENTE: process.env.EDUTECH_CORREO_REMITENTE ?? "Hackathon EduTech",
  EDUTECH_SLACK_CANAL_STAFF: "",
};
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

async function api<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "X-N8N-API-KEY": CLAVE, "Content-Type": "application/json", Accept: "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${ruta} → HTTP ${r.status}: ${texto.slice(0, 300)}`);
  return (texto ? JSON.parse(texto) : {}) as T;
}

/** Reemplaza `$env.EDUTECH_*` por el valor literal (como cadena JS) en todo el workflow. */
function inyectar<T>(valor: T): T {
  if (typeof valor === "string") {
    return valor.replace(/\$env\.(EDUTECH_[A-Z_]+)/g, (_, k: string) => {
      if (!(k in CONFIG)) throw new Error(`Variable sin valor: ${k}`);
      return JSON.stringify(CONFIG[k]);
    }) as T;
  }
  if (Array.isArray(valor)) return valor.map(inyectar) as T;
  if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, inyectar(v)])) as T;
  return valor;
}

type Nodo = WorkflowJson["nodes"][number] & Record<string, unknown>;

function adaptar(wf: WorkflowJson, cred: { telegram: { id: string; name: string }; gmail: { id: string; name: string } }): WorkflowJson {
  const conCertificado = wf.nodes.some((n) => n.name === "Generar certificado PDF");
  const nodes = wf.nodes.map((n): Nodo => {
    const base = n as Nodo;
    if (n.type === "n8n-nodes-base.slack" && !(cred.telegram.id && TELEGRAM_CHAT_ID)) {
      // Sin Telegram: los avisos al staff llegan por correo a la mesa técnica.
      return {
        ...base,
        name: n.name.replace("Avisar en Slack", "Avisar al staff por correo"),
        type: "n8n-nodes-base.gmail",
        typeVersion: 2.1,
        parameters: {
          sendTo: CONFIG.EDUTECH_CORREO_MESA_TECNICA,
          subject: "[Staff Hackathon EduTech] Aviso",
          emailType: "text",
          message: "={{ $json.mensaje }}",
          options: { appendAttribution: false, senderName: CONFIG.EDUTECH_CORREO_REMITENTE },
        },
        ...(cred.gmail.id ? { credentials: { gmailOAuth2: cred.gmail } } : { credentials: undefined }),
      };
    }
    if (n.type === "n8n-nodes-base.slack") {
      return {
        ...base,
        name: n.name.replace("Avisar en Slack", "Avisar por Telegram"),
        type: "n8n-nodes-base.telegram",
        typeVersion: 1.2,
        parameters: { chatId: TELEGRAM_CHAT_ID, text: "={{ $json.mensaje }}", additionalFields: { appendAttribution: false } },
        ...(cred.telegram.id ? { credentials: { telegramApi: cred.telegram } } : { credentials: undefined }),
      };
    }
    if (n.type === "n8n-nodes-base.httpRequest" && String(n.parameters.url).includes("api.resend.com")) {
      return {
        ...base,
        name: n.name.replace("Enviar correo (Resend)", "Enviar correo (Gmail)"),
        type: "n8n-nodes-base.gmail",
        typeVersion: 2.1,
        parameters: {
          sendTo: "={{ $json.para.join(',') }}",
          subject: "={{ $json.asunto }}",
          emailType: "html",
          message: "={{ $json.html }}",
          options: {
            appendAttribution: false,
            senderName: CONFIG.EDUTECH_CORREO_REMITENTE,
            ...(conCertificado ? { attachmentsUi: { attachmentsBinary: [{ property: "certificado" }] } } : {}),
          },
        },
        ...(cred.gmail.id ? { credentials: { gmailOAuth2: cred.gmail } } : { credentials: undefined }),
      };
    }
    return base;
  });
  // Renombrar nodos obliga a renombrar sus conexiones.
  const nuevoNombre = new Map(wf.nodes.map((n, i) => [n.name, nodes[i]!.name]));
  const connections = Object.fromEntries(
    Object.entries(wf.connections).map(([desde, c]) => [
      nuevoNombre.get(desde) ?? desde,
      { main: c.main.map((salida) => salida.map((d) => ({ ...d, node: nuevoNombre.get(d.node) ?? d.node }))) },
    ]),
  );
  return { ...wf, nodes, connections };
}

async function main() {
  const workflows = cargarWorkflows();
  for (const { archivo, wf } of workflows) {
    const errores = validarWorkflow(wf);
    if (errores.length) throw new Error(`${archivo}: ${errores.join("; ")}`);
  }

  // Credenciales: Telegram se puede crear por API; Gmail (OAuth) solo desde la interfaz.
  let telegram = { id: process.env.TELEGRAM_CREDENCIAL_ID ?? "", name: "Telegram EduTech" };
  if (!telegram.id && process.env.TELEGRAM_BOT_TOKEN) {
    const c = await api<{ id: string; name: string }>("POST", "/credentials", { name: "Telegram EduTech", type: "telegramApi", data: { accessToken: process.env.TELEGRAM_BOT_TOKEN } });
    telegram = { id: c.id, name: c.name };
    console.log(`Credencial de Telegram creada (${c.id}). Guarda TELEGRAM_CREDENCIAL_ID=${c.id} en .env.n8n.`);
  }
  const gmail = { id: process.env.GMAIL_CREDENCIAL_ID ?? "", name: "Gmail EduTech" };
  if (!gmail.id) console.log("⚠️  Sin GMAIL_CREDENCIAL_ID: elige la credencial «Gmail EduTech» en los nodos de correo desde la interfaz.");
  if (!(telegram.id && TELEGRAM_CHAT_ID)) console.log("ℹ️  Sin Telegram: los avisos al staff irán por correo a EDUTECH_CORREO_MESA_TECNICA.");

  const existentes = (await api<{ data: { id: string; name: string; active: boolean }[] }>("GET", "/workflows?limit=250")).data;
  const porNombre = new Map(existentes.map((w) => [w.name, w]));

  // WF-99 primero: los demás lo referencian como Error workflow.
  const orden = [...workflows].sort((a, b) => (a.archivo.startsWith("WF-99") ? -1 : b.archivo.startsWith("WF-99") ? 1 : a.archivo.localeCompare(b.archivo)));
  let idErrores = "";
  for (const { archivo, wf } of orden) {
    const listo = adaptar(inyectar(wf), { telegram, gmail });
    const settings = { ...listo.settings, ...(idErrores && !archivo.startsWith("WF-99") ? { errorWorkflow: idErrores } : {}) };
    const cuerpo = { name: listo.name, nodes: listo.nodes, connections: listo.connections, settings };
    const previo = porNombre.get(listo.name);
    const guardado = previo ? await api<{ id: string }>("PUT", `/workflows/${previo.id}`, cuerpo) : await api<{ id: string }>("POST", "/workflows", cuerpo);
    if (archivo.startsWith("WF-99")) idErrores = guardado.id;
    let estado = "guardado";
    try {
      await api("POST", `/workflows/${guardado.id}/activate`);
      estado = "activo";
    } catch (e) {
      estado = `guardado, sin activar (${(e as Error).message.slice(0, 120)})`;
    }
    console.log(`${previo ? "Actualizado" : "Creado"} ${listo.name} [${guardado.id}] · ${estado}`);
  }
  console.log(`\nWebhooks: ${requerida("N8N_API_URL").replace(/\/$/, "")}/webhook/<evento>  →  N8N_WEBHOOK_BASE_URL de la app.`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
