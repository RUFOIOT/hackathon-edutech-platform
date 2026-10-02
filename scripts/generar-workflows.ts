/**
 * Genera los workflows importables de n8n en n8n/workflows/ (Fase 7).
 *
 * Los JSON se generan desde aquí para que los diez flujos compartan exactamente el mismo código de
 * verificación de firma, de firma de peticiones a la app y de envío de correo. Para cambiar un
 * flujo, edita este archivo y corre `npm run n8n:generar`; no edites los JSON a mano.
 *
 * Variables de entorno que n8n debe tener (n8n/README.md): EDUTECH_APP_URL, EDUTECH_SHARED_SECRET,
 * EDUTECH_CORREO_REMITENTE, EDUTECH_CORREO_COMITE, EDUTECH_CORREO_MESA_TECNICA,
 * EDUTECH_SLACK_CANAL_STAFF. Credenciales (por nombre, nunca valores): "Resend API" y "Slack EduTech".
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Posicion = [number, number];
interface Nodo {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: Posicion;
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  webhookId?: string;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  onError?: string;
  notes?: string;
}

const uuid = (semilla: string) => {
  const h = createHash("sha256").update(semilla).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

export const CREDENCIALES = {
  resend: { httpHeaderAuth: { id: "REEMPLAZAR-resend", name: "Resend API" } },
  slack: { slackApi: { id: "REEMPLAZAR-slack", name: "Slack EduTech" } },
};

// ---------------------------------------------------------------------------------------------
// Código compartido de los nodos Code (JavaScript de n8n, modo "Run Once for All Items").
// Sin backticks ni ${} para que se pueda incrustar tal cual.
// ---------------------------------------------------------------------------------------------

/** Verifica X-Signature (HMAC-SHA256 de `${timestamp}.${cuerpo}`) y X-Timestamp (±5 min). */
export const JS_VERIFICAR = `// Verifica la firma de la app (mismo algoritmo que lib/hmac.ts).
const crypto = require('crypto');
const secreto = $env.EDUTECH_SHARED_SECRET;
const item = $input.first();
const h = item.json.headers || {};
let crudo;
try {
  // El webhook guarda el cuerpo crudo (opción Raw Body): se firma el texto exacto, no el JSON re-serializado.
  crudo = (await this.helpers.getBinaryDataBuffer(0, 'data')).toString('utf8');
} catch (e) {
  crudo = JSON.stringify(item.json.body);
}
const ts = String(h['x-timestamp'] || '');
const firma = String(h['x-signature'] || '');
const ahora = Math.floor(Date.now() / 1000);
let motivo = null;
if (!secreto) motivo = 'sin-secreto';
else if (!ts || !firma) motivo = 'faltan-cabeceras';
else if (!/^\\d{9,11}$/.test(ts)) motivo = 'timestamp-invalido';
else if (Math.abs(ahora - Number(ts)) > 300) motivo = 'fuera-de-ventana';
else {
  const esperada = Buffer.from('sha256=' + crypto.createHmac('sha256', secreto).update(ts + '.' + crudo).digest('hex'));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) motivo = 'firma-invalida';
}
if (motivo) return [{ json: { firmaValida: false, motivo } }];
return [{ json: { firmaValida: true, evento: JSON.parse(crudo) } }];`;

/** Firma cada petición hacia la app. `peticion` es una expresión JS evaluada por ítem. */
export const jsFirmar = (peticion: string) => `// Firma la petición hacia la app (X-Timestamp + X-Signature, lib/hmac.ts).
const crypto = require('crypto');
const secreto = $env.EDUTECH_SHARED_SECRET;
return $input.all().map((item, i) => {
  const peticion = ${peticion};
  const cuerpo = JSON.stringify(peticion);
  const ts = String(Math.floor(Date.now() / 1000));
  const firma = 'sha256=' + crypto.createHmac('sha256', secreto).update(ts + '.' + cuerpo).digest('hex');
  return { json: { contexto: item.json.contexto || null, cuerpo, ts, firma } };
});`;

/** Utilidades para redactar: escape HTML, plantilla de correo con la franja de colores, Slack. */
const JS_COMUN = `const APP = $env.EDUTECH_APP_URL;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plano = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const html = (titulo, parrafos, boton) =>
  '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0e1b3d">' +
  '<div style="height:6px;background:linear-gradient(90deg,#6aa3dc,#e8a0b0,#6fb38c,#f0b23a)"></div>' +
  '<h1 style="font-size:22px;margin:24px 0 12px">' + esc(titulo) + '</h1>' +
  parrafos.map((p) => '<p style="font-size:15px;line-height:1.55;margin:0 0 12px">' + p + '</p>').join('') +
  (boton ? '<p style="margin:20px 0"><a href="' + esc(boton.url) + '" style="display:inline-block;background:#c9a24a;color:#0e1b3d;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">' + esc(boton.texto) + '</a></p>' : '') +
  '<p style="font-size:12px;color:#5b6478;margin-top:28px">Hackathon EduTech Eight Academy by n8n · 6 y 7 de noviembre de 2026 · Quito</p></div>';
const correo = (para, asunto, titulo, parrafos, boton) => ({
  json: {
    canal: 'correo',
    para: [].concat(para).filter(Boolean),
    asunto,
    html: html(titulo, parrafos, boton),
    texto: [titulo].concat(parrafos.map(plano), boton ? [boton.texto + ': ' + boton.url] : []).join('\\n\\n'),
  },
});
// Un correo por persona: nadie ve las direcciones de los demás.
const correoACada = (lista, asunto, titulo, parrafos, boton) => [].concat(lista).filter(Boolean).map((p) => correo(p, asunto, titulo, parrafos, boton));
const slack = (mensaje) => ({ json: { canal: 'slack', mensaje } });
const salida = [];
`;
const JS_FIN = `
return salida.filter((i) => i.json.canal !== 'correo' || i.json.para.length > 0);`;
export const jsRedactar = (cuerpo: string) => `${JS_COMUN}${cuerpo.trim()}${JS_FIN}`;

// ---------------------------------------------------------------------------------------------
// Constructor de workflows
// ---------------------------------------------------------------------------------------------

class Flujo {
  nodos: Nodo[] = [];
  conexiones: Record<string, { main: { node: string; type: "main"; index: number }[][] }> = {};
  constructor(
    readonly archivo: string,
    readonly nombre: string,
  ) {}

  nodo(n: Omit<Nodo, "id">): string {
    if (this.nodos.some((x) => x.name === n.name)) throw new Error(`Nodo duplicado en ${this.nombre}: ${n.name}`);
    this.nodos.push({ id: uuid(`${this.archivo}/${n.name}`), ...n });
    return n.name;
  }

  unir(desde: string, hacia: string, salida = 0) {
    const c = (this.conexiones[desde] ??= { main: [] });
    while (c.main.length <= salida) c.main.push([]);
    c.main[salida]!.push({ node: hacia, type: "main", index: 0 });
  }

  cadena(...nombres: string[]) {
    for (let i = 0; i < nombres.length - 1; i++) this.unir(nombres[i]!, nombres[i + 1]!);
  }

  // --- nodos ---

  webhook(path: string, pos: Posicion) {
    return this.nodo({
      name: `Webhook ${path}`,
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: pos,
      webhookId: uuid(`webhook/${path}`),
      parameters: { httpMethod: "POST", path, responseMode: "responseNode", options: { rawBody: true } },
    });
  }

  programado(nombre: string, crons: string[], pos: Posicion) {
    return this.nodo({
      name: nombre,
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: pos,
      parameters: { rule: { interval: crons.map((expression) => ({ field: "cronExpression", expression })) } },
    });
  }

  codigo(nombre: string, jsCode: string, pos: Posicion, notes?: string) {
    return this.nodo({ name: nombre, type: "n8n-nodes-base.code", typeVersion: 2, position: pos, parameters: { jsCode }, ...(notes ? { notes } : {}) });
  }

  si(nombre: string, izquierda: string, operador: { type: string; operation: string; singleValue?: boolean }, derecha: unknown, pos: Posicion) {
    return this.nodo({
      name: nombre,
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: pos,
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "loose" },
          conditions: [{ id: uuid(`${this.archivo}/${nombre}/cond`), leftValue: izquierda, rightValue: derecha, operator: operador }],
          combinator: "and",
        },
        options: {},
      },
    });
  }

  responder(nombre: string, codigo: number, cuerpo: Record<string, unknown>, pos: Posicion) {
    return this.nodo({
      name: nombre,
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: pos,
      parameters: { respondWith: "json", responseBody: JSON.stringify(cuerpo), options: { responseCode: codigo } },
    });
  }

  esperar(nombre: string, minutos: number, pos: Posicion) {
    return this.nodo({
      name: nombre,
      type: "n8n-nodes-base.wait",
      typeVersion: 1.1,
      position: pos,
      webhookId: uuid(`${this.archivo}/${nombre}`),
      parameters: { amount: minutos, unit: "minutes" },
    });
  }

  /** POST firmado a la app; el nodo anterior debe ser un "Firmar …" (cuerpo, ts, firma). */
  llamarApp(nombre: string, ruta: string, pos: Posicion, archivo = false) {
    return this.nodo({
      name: nombre,
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: pos,
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 5000,
      parameters: {
        method: "POST",
        url: `={{ $env.EDUTECH_APP_URL }}${ruta}`,
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "X-Timestamp", value: "={{ $json.ts }}" },
            { name: "X-Signature", value: "={{ $json.firma }}" },
          ],
        },
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: "={{ $json.cuerpo }}",
        options: { timeout: 60000, ...(archivo ? { response: { response: { responseFormat: "file" } } } : {}) },
      },
    });
  }

  /** Enviar por Resend o Slack según `canal` de cada ítem redactado. */
  envios(desde: string, sufijo: string, x: number, y: number) {
    const si = this.si(`¿Correo?${sufijo}`, "={{ $json.canal }}", { type: "string", operation: "equals" }, "correo", [x, y]);
    const correo = this.nodo({
      name: `Enviar correo (Resend)${sufijo}`,
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [x + 240, y - 100],
      credentials: CREDENCIALES.resend,
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 2000,
      onError: "continueRegularOutput",
      parameters: {
        method: "POST",
        url: "https://api.resend.com/emails",
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ JSON.stringify({ from: $env.EDUTECH_CORREO_REMITENTE, to: $json.para, subject: $json.asunto, html: $json.html, text: $json.texto, attachments: $json.adjuntos }) }}",
        // Resend admite 2 peticiones por segundo en el plan base.
        options: { batching: { batch: { batchSize: 2, batchInterval: 1100 } } },
      },
    });
    const slack = this.nodo({
      name: `Avisar en Slack${sufijo}`,
      type: "n8n-nodes-base.slack",
      typeVersion: 2.2,
      position: [x + 240, y + 100],
      credentials: CREDENCIALES.slack,
      onError: "continueRegularOutput",
      parameters: {
        select: "channel",
        channelId: { __rl: true, value: "={{ $env.EDUTECH_SLACK_CANAL_STAFF }}", mode: "id" },
        text: "={{ $json.mensaje }}",
        otherOptions: {},
      },
    });
    this.unir(desde, si);
    this.unir(si, correo, 0);
    this.unir(si, slack, 1);
  }

  /** Webhooks → verificar firma → 200/401. Devuelve el nodo "Responder 200" para seguir. */
  entradaFirmada(paths: string[], x = 0, y = 300): string {
    const verificar = this.codigo("Verificar firma", JS_VERIFICAR, [x + 260, y], "Rechaza con 401 si la firma o el timestamp no son válidos.");
    paths.forEach((p, i) => this.unir(this.webhook(p, [x, y + (i - (paths.length - 1) / 2) * 180]), verificar));
    const si = this.si("¿Firma válida?", "={{ $json.firmaValida }}", { type: "boolean", operation: "true", singleValue: true }, "", [x + 500, y]);
    const ok = this.responder("Responder 200", 200, { ok: true }, [x + 740, y - 100]);
    const no = this.responder("Responder 401", 401, { ok: false, error: "Firma inválida" }, [x + 740, y + 100]);
    this.cadena(verificar, si);
    this.unir(si, ok, 0);
    this.unir(si, no, 1);
    return ok;
  }

  json() {
    return {
      name: this.nombre,
      nodes: this.nodos,
      connections: this.conexiones,
      active: false,
      settings: {
        executionOrder: "v1",
        timezone: "America/Guayaquil",
        // No guardar ejecuciones exitosas: contienen correos y nombres (LOPDP). Los errores sí.
        saveDataSuccessExecution: "none",
        saveDataErrorExecution: "all",
        saveManualExecutions: false,
        callerPolicy: "workflowsFromSameOwner",
      },
      pinData: {},
      meta: { templateCredsSetupCompleted: false },
    };
  }
}

// ---------------------------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------------------------

const EVENTO = "const e = $input.first().json.evento;\nconst p = e.payload;\n";
const RESPUESTA = "const r = $input.first().json;\n";

export function construirWorkflows(): Flujo[] {
  const flujos: Flujo[] = [];

  // WF-00 · Reintento del outbox (soporte de D-19; no está en la tabla del prompt).
  {
    const f = new Flujo("WF-00-reintento-eventos", "WF-00 · Reintento de eventos pendientes");
    const cron = f.programado("Cada 5 minutos", ["*/5 * * * *"], [0, 300]);
    const firmar = f.codigo("Firmar petición", jsFirmar("({})"), [240, 300]);
    const app = f.llamarApp("Reintentar en la app", "/api/eventos/reintentar", [480, 300]);
    const redactar = f.codigo(
      "Redactar alerta",
      jsRedactar(`${RESPUESTA}
if (r.fallidos > 0) salida.push(slack('⚠️ ' + r.fallidos + ' evento(s) hacia n8n fallaron 10 veces y quedaron "fallido" en event_outbox. Revisa docs/RUNBOOK.md (n8n no responde).'));`),
      [720, 300],
    );
    f.cadena(cron, firmar, app, redactar);
    f.envios(redactar, "", 960, 300);
    flujos.push(f);
  }

  // WF-01 · Confirmación de inscripción (+ decisión de autorización y check-in Junior).
  {
    const f = new Flujo("WF-01-confirmacion-inscripcion", "WF-01 · Confirmación de inscripción");
    const ok = f.entradaFirmada(["registration.created", "guardian.validated", "checkin.created"]);
    const redactar = f.codigo(
      "Redactar mensajes",
      jsRedactar(`${EVENTO}
if (e.type === 'registration.created') {
  const parrafos = ['Hola ' + esc(p.nombres) + ', recibimos tu inscripción al Hackathon EduTech Eight Academy by n8n.'];
  if (p.listaEspera) parrafos.push('Por ahora estás en <strong>lista de espera</strong> porque el cupo está completo. Te escribiremos apenas se libere un lugar.');
  else if (p.teamNombre) parrafos.push('Equipo: <strong>' + esc(p.teamNombre) + '</strong>.' + (p.codigoInvitacion ? ' Comparte este código para que tu equipo se una: <strong>' + esc(p.codigoInvitacion) + '</strong>.' : ''));
  else parrafos.push('Te inscribiste sin equipo: en el matchmaking del viernes 6 te ayudamos a formar uno.');
  if (p.requiereAutorizacion) parrafos.push('<strong>Importante:</strong> como eres de la categoría Junior, tu representante legal debe firmar la autorización y subirla desde Mi equipo. Sin ella no puedes participar.');
  parrafos.push('Próximos pasos: lee la Guía del hacker, ten lista tu cuenta de GitHub y prepárate para el kick-off del viernes 6 de noviembre a las 15:30 (hora de Ecuador).');
  salida.push(correo(p.email, 'Inscripción recibida · Hackathon EduTech', 'Inscripción recibida', parrafos, { texto: 'Ir a Mi equipo', url: APP + '/mi-equipo' }));
  salida.push(slack('Nueva inscripción ' + (p.categoria === 'JUNIOR' ? 'Junior' : 'Open') + ' · ' + p.modo + (p.teamNombre ? ' · equipo ' + p.teamNombre : '') + (p.listaEspera ? ' · lista de espera' : '')));
}
if (e.type === 'guardian.validated') {
  if (p.decision === 'validado') {
    salida.push(correo(p.email, 'Autorización validada · Hackathon EduTech', 'Autorización validada', ['Hola ' + esc(p.nombres) + ', validamos la autorización de tu representante. Ya puedes participar.'], { texto: 'Ir a Mi equipo', url: APP + '/mi-equipo' }));
  } else {
    salida.push(correo(p.email, 'Revisa tu autorización · Hackathon EduTech', 'No pudimos validar la autorización', ['Hola ' + esc(p.nombres) + ', la autorización que subiste no se pudo validar (falta una firma o el documento no se lee).', 'Descarga de nuevo la plantilla, pide a tu representante que la firme y súbela desde Mi equipo.'], { texto: 'Subir la autorización', url: APP + '/mi-equipo' }));
  }
}
if (e.type === 'checkin.created' && p.categoria === 'JUNIOR') {
  salida.push(slack('Check-in Junior (' + p.dia + '): confirma que su mentor adulto asignado esté en la sede.'));
}`),
      [1000, 200],
    );
    f.unir(ok, redactar);
    f.envios(redactar, "", 1240, 200);
    flujos.push(f);
  }

  // WF-02 · Invitaciones de equipo.
  {
    const f = new Flujo("WF-02-invitaciones-equipo", "WF-02 · Invitaciones de equipo");
    const ok = f.entradaFirmada(["team.invitation", "team.completed"]);
    const redactar = f.codigo(
      "Redactar mensajes",
      jsRedactar(`${EVENTO}
if (e.type === 'team.invitation') {
  salida.push(correo(p.correo, p.invitadoPor + ' te invitó a su equipo · Hackathon EduTech', 'Te invitaron a un equipo',
    [esc(p.invitadoPor) + ' te invitó al equipo <strong>' + esc(p.teamNombre) + '</strong> (track ' + esc(p.track) + ') del Hackathon EduTech Eight Academy by n8n.',
     'Tu código de equipo es <strong>' + esc(p.codigo) + '</strong>. Inscríbete con el enlace: el código ya va incluido.',
     'Si no esperabas este correo, ignóralo: nadie se une sin completar la inscripción.'],
    { texto: 'Unirme al equipo', url: p.enlace }));
}
if (e.type === 'team.completed') {
  salida.push(slack('El equipo ' + p.teamNombre + ' alcanzó el mínimo de integrantes (' + p.miembros + ').'));
}`),
      [1000, 200],
    );
    f.unir(ok, redactar);
    f.envios(redactar, "", 1240, 200);
    flujos.push(f);
  }

  // WF-03 · Recordatorios de convocatoria (la app decide si sigue abierta).
  {
    const f = new Flujo("WF-03-recordatorios-convocatoria", "WF-03 · Recordatorios de convocatoria");
    const cron = f.programado("Cada día a las 09:00", ["0 9 * * *"], [0, 300]);
    const firmar = f.codigo("Firmar consulta", jsFirmar("({ consulta: 'recordatorios-convocatoria' })"), [240, 300]);
    const app = f.llamarApp("Consultar a la app", "/api/n8n/consulta", [480, 300]);
    const redactar = f.codigo(
      "Redactar recordatorios",
      jsRedactar(`${RESPUESTA}
if (!r.activo) return [];
const cierre = new Date(r.cierre).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'full', timeStyle: 'short' });
for (const a of r.autorizacionesPendientes) {
  salida.push(...correoACada(a.para, 'Falta la autorización del representante · Hackathon EduTech', 'Falta la autorización',
    ['La inscripción de ' + esc(a.nombres) + ' (categoría Junior) está completa salvo la autorización firmada del representante legal.',
     a.archivoSubido ? 'Ya recibimos un archivo y lo estamos revisando; si te pedimos corregirlo, súbelo de nuevo.' : 'Descarga la plantilla, fírmala y súbela desde Mi equipo antes del ' + esc(cierre) + '.'],
    { texto: 'Ir a Mi equipo', url: a.enlace }));
}
for (const t of r.equiposIncompletos) {
  salida.push(...correoACada(t.para, 'Tu equipo aún no está completo · Hackathon EduTech', 'Completa tu equipo',
    ['El equipo <strong>' + esc(t.teamNombre) + '</strong> tiene ' + t.miembros + ' integrante(s). Necesitan al menos 2 para competir.',
     'Comparte el código <strong>' + esc(t.codigo) + '</strong> o el enlace de abajo. Las inscripciones cierran el ' + esc(cierre) + '.'],
    { texto: 'Enlace para invitar', url: t.enlace }));
}
if (r.webinar) {
  const fecha = new Date(r.webinar.fecha).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'full', timeStyle: 'short' });
  salida.push(...correoACada(r.webinar.para, 'Webinar de preparación: GitHub y n8n', 'Webinar de preparación',
    ['Te esperamos en el webinar de preparación sobre GitHub y n8n el ' + esc(fecha) + ' (hora de Ecuador). Te enviaremos el enlace de conexión el mismo día.']));
}
salida.push(slack('Recordatorios de convocatoria: ' + r.autorizacionesPendientes.length + ' autorizaciones pendientes, ' + r.equiposIncompletos.length + ' equipos incompletos.'));`),
      [720, 300],
    );
    f.cadena(cron, firmar, app, redactar);
    f.envios(redactar, "", 960, 300);
    flujos.push(f);
  }

  // WF-04 · Monitor de repositorios (cada 15 min durante la ventana de hacking).
  {
    const f = new Flujo("WF-04-monitor-repositorios", "WF-04 · Monitor de repositorios");
    // Ventana: viernes 6 15:30 → sábado 7 12:00 (config/event.ts). Ajusta si cambian las fechas.
    const cron = f.programado("Cada 15 min en la ventana", ["*/15 15-23 6 11 *", "*/15 0-11 7 11 *", "0 12 7 11 *"], [0, 300]);
    const firmar = f.codigo("Firmar petición", jsFirmar("({ todos: true })"), [240, 300]);
    const app = f.llamarApp("Snapshot de todos los repos", "/api/github/snapshot", [480, 300]);
    const redactar = f.codigo(
      "Redactar alertas nuevas",
      jsRedactar(`${RESPUESTA}
// Solo avisa alertas nuevas: recuerda las ya enviadas en los datos estáticos del workflow.
const memoria = $getWorkflowStaticData('global');
memoria.enviadas = memoria.enviadas || {};
const nuevas = [];
for (const x of r.resultados || []) {
  for (const detalle of x.alertasRojas || []) {
    const clave = x.teamId + '|' + detalle;
    if (memoria.enviadas[clave]) continue;
    memoria.enviadas[clave] = Date.now();
    nuevas.push({ teamId: x.teamId, detalle });
  }
}
const fallidos = (r.resultados || []).filter((x) => !x.ok).length;
if (nuevas.length) {
  salida.push(slack('🚨 Alertas rojas en repositorios:\\n' + nuevas.map((n) => '• ' + n.teamId + ': ' + n.detalle).join('\\n')));
  salida.push(correo($env.EDUTECH_CORREO_MESA_TECNICA, 'Alertas rojas en repositorios (' + nuevas.length + ')', 'Alertas rojas en repositorios',
    ['<ul>' + nuevas.map((n) => '<li><strong>' + esc(n.teamId) + '</strong>: ' + esc(n.detalle) + '</li>').join('') + '</ul>'],
    { texto: 'Abrir repositorios', url: APP + '/admin/repositorios' }));
}
if (fallidos > 3) salida.push(slack('⚠️ ' + fallidos + ' repositorios no se pudieron leer. Puede ser el límite de la API de GitHub: revisa docs/RUNBOOK.md.'));`),
      [720, 300],
    );
    f.cadena(cron, firmar, app, redactar);
    f.envios(redactar, "", 960, 300);
    flujos.push(f);
  }

  // WF-05 · Recordatorio de checkpoints (30 min antes de cada checkpoint y del freeze).
  {
    const f = new Flujo("WF-05-recordatorio-checkpoints", "WF-05 · Recordatorio de checkpoints");
    const hitos = [
      { cron: "30 18 6 11 *", hito: "checkpoint1", nombre: "Viernes 18:30 (checkpoint 1)" },
      { cron: "0 10 7 11 *", hito: "checkpoint2", nombre: "Sábado 10:00 (checkpoint 2)" },
      { cron: "30 11 7 11 *", hito: "freeze", nombre: "Sábado 11:30 (code freeze)" },
    ];
    const firmar = f.codigo("Firmar consulta", jsFirmar("item.json.peticion"), [480, 300]);
    hitos.forEach((h, i) => {
      const y = 120 + i * 180;
      const cron = f.programado(h.nombre, [h.cron], [0, y]);
      const marcar = f.codigo(`Hito ${h.hito}`, `return [{ json: { peticion: { consulta: 'checkpoints-en-riesgo', hito: '${h.hito}' } } }];`, [240, y]);
      f.cadena(cron, marcar, firmar);
    });
    const app = f.llamarApp("Consultar a la app", "/api/n8n/consulta", [720, 300]);
    const redactar = f.codigo(
      "Redactar avisos",
      jsRedactar(`${RESPUESTA}
const NOMBRE = { checkpoint1: 'el checkpoint 1', checkpoint2: 'el checkpoint 2', freeze: 'el code freeze' };
const hora = new Date(r.limite).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit' });
for (const t of r.enRiesgo) {
  salida.push(...correoACada(t.para, 'Faltan 30 minutos para ' + NOMBRE[r.hito], 'Faltan 30 minutos para ' + NOMBRE[r.hito],
    ['Equipo <strong>' + esc(t.teamNombre) + '</strong>: ' + esc(t.motivo), 'La hora límite es las ' + esc(hora) + '. Lo que no esté en el repositorio a esa hora no cuenta.'],
    { texto: 'Revisar mi repositorio', url: t.enlace }));
}
salida.push(slack('Recordatorio de ' + NOMBRE[r.hito] + ': ' + r.enRiesgo.length + ' equipo(s) en riesgo' + (r.enRiesgo.length ? ' (' + r.enRiesgo.map((t) => t.teamNombre).join(', ') + ')' : '') + '.'));`),
      [960, 300],
    );
    f.cadena(firmar, app, redactar);
    f.envios(redactar, "", 1200, 300);
    flujos.push(f);
  }

  // WF-06 · Validación de entregas (12:05 del sábado) + acuse de cada entrega.
  {
    const f = new Flujo("WF-06-validacion-entregas", "WF-06 · Validación de entregas");
    const cron = f.programado("Sábado 12:05", ["5 12 7 11 *"], [0, 600]);
    const firmarSnap = f.codigo("Firmar snapshot final", jsFirmar("({ todos: true })"), [240, 600]);
    const snap = f.llamarApp("Snapshot final", "/api/github/snapshot", [480, 600]);
    const firmarRep = f.codigo("Firmar reporte", jsFirmar("({ consulta: 'reporte-entregas' })"), [720, 600]);
    const rep = f.llamarApp("Reporte de admisibilidad", "/api/n8n/consulta", [960, 600]);
    const redactarRep = f.codigo(
      "Redactar reporte",
      jsRedactar(`${RESPUESTA}
const filas = r.equipos.map((t) => '<tr><td>' + esc(t.teamNombre) + '</td><td>' + esc(t.track) + '</td><td>' + (t.entregado ? 'Sí' : 'No') + '</td><td>' +
  (esc([].concat(t.fallas, t.tagMovidoTrasFreeze ? ['tag movido'] : [], t.a4Pendiente ? ['A4 por revisar'] : []).join(', ')) || '—') + '</td></tr>').join('');
salida.push(correo($env.EDUTECH_CORREO_COMITE, 'Reporte de entregas y admisibilidad', 'Reporte de entregas (12:05)',
  [r.entregados + ' de ' + r.total + ' equipos entregaron; ' + r.admisibles + ' cumplen A1–A5 por ahora (A4 lo confirma la mesa técnica).',
   '<table style="border-collapse:collapse;font-size:13px" border="1" cellpadding="6"><tr><th>Equipo</th><th>Track</th><th>Entregó</th><th>Observaciones</th></tr>' + filas + '</table>'],
  { texto: 'Revisar en el panel', url: r.enlace }));
salida.push(slack('Code freeze: ' + r.entregados + '/' + r.total + ' entregas, ' + r.admisibles + ' admisibles por ahora. Reporte enviado al comité.'));`),
      [1200, 600],
    );
    f.cadena(cron, firmarSnap, snap, firmarRep, rep, redactarRep);
    f.envios(redactarRep, " (reporte)", 1440, 600);

    const ok = f.entradaFirmada(["submission.created"], 0, 200);
    const acuse = f.codigo(
      "Redactar acuse",
      jsRedactar(`${EVENTO}
const hora = new Date(p.tagCommitAt).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'medium', timeStyle: 'short' });
salida.push(...correoACada(p.destinatarios, (p.reenvio ? 'Entrega actualizada' : 'Entrega recibida') + ' · ' + p.teamNombre, p.reenvio ? 'Entrega actualizada' : 'Entrega recibida',
  ['Recibimos la entrega del equipo <strong>' + esc(p.teamNombre) + '</strong>.',
   'Tag entrega: <code>' + esc(String(p.tagSha).slice(0, 7)) + '</code> (commit del ' + esc(hora) + '). Demo: ' + (p.demoUrl === 'ejecucion-local' ? 'ejecución local' : esc(p.demoUrl)) + '.',
   'Puedes volver a enviar hasta el code freeze (sábado 12:00); se evalúa la última entrega.'],
  { texto: 'Ver mi entrega', url: APP + '/mi-equipo/entrega' }));
salida.push(slack((p.reenvio ? 'Entrega actualizada: ' : 'Entrega recibida: ') + p.teamNombre + ' (' + p.track + ').'));`),
      [1000, 100],
    );
    f.unir(ok, acuse);
    f.envios(acuse, " (acuse)", 1240, 100);
    flujos.push(f);
  }

  // WF-07 · Mentoría: avisa a los mentores del tema y escala a los 30 min sin atender.
  {
    const f = new Flujo("WF-07-mentoria", "WF-07 · Mentoría");
    const ok = f.entradaFirmada(["mentor.requested"]);
    const firmarM = f.codigo("Firmar consulta de mentores", jsFirmar("({ consulta: 'mentores', tema: $('Verificar firma').first().json.evento.payload.tema })"), [1000, 100]);
    const appM = f.llamarApp("Mentores del tema", "/api/n8n/consulta", [1240, 100]);
    const avisar = f.codigo(
      "Redactar aviso a mentores",
      jsRedactar(`${RESPUESTA}
const p = $('Verificar firma').first().json.evento.payload;
const TEMA = { producto: 'Producto', tecnica: 'Técnica', n8n: 'n8n', ia: 'IA', pitch: 'Pitch' };
salida.push(...correoACada(r.para, 'Mentoría pedida: ' + p.teamNombre + ' · ' + TEMA[p.tema], 'Un equipo pide mentoría',
  ['Equipo <strong>' + esc(p.teamNombre) + '</strong> · tema <strong>' + esc(TEMA[p.tema]) + '</strong>.', p.detalle ? '“' + esc(p.detalle) + '”' : 'Sin detalle.', 'Toma la solicitud en el panel para que el resto sepa que vas en camino.'],
  { texto: 'Abrir la cola de mentoría', url: r.enlace }));
salida.push(slack('Mentoría pedida: ' + p.teamNombre + ' · ' + TEMA[p.tema] + (r.para.length ? '' : ' · ⚠️ no hay mentores con ese tema')));`),
      [1480, 100],
    );
    f.cadena(ok, firmarM, appM, avisar);
    f.envios(avisar, " (aviso)", 1720, 100);

    const esperar = f.esperar("Esperar 30 minutos", 30, [1000, 500]);
    const firmarE = f.codigo("Firmar consulta de estado", jsFirmar("({ consulta: 'mentoria-estado', requestId: $('Verificar firma').first().json.evento.payload.requestId })"), [1240, 500]);
    const appE = f.llamarApp("Estado de la solicitud", "/api/n8n/consulta", [1480, 500]);
    const escalar = f.codigo(
      "Redactar escalamiento",
      jsRedactar(`${RESPUESTA}
if (!r.existe || r.estado !== 'abierta') return [];
const p = $('Verificar firma').first().json.evento.payload;
salida.push(slack('⏰ Mentoría sin atender hace ' + r.minutosEspera + ' min: ' + p.teamNombre + ' · ' + p.tema + '. ¿Quién puede ir?'));
salida.push(correo($env.EDUTECH_CORREO_MESA_TECNICA, 'Mentoría sin atender (30 min): ' + p.teamNombre, 'Mentoría sin atender',
  ['El equipo <strong>' + esc(p.teamNombre) + '</strong> espera mentoría de ' + esc(p.tema) + ' hace ' + r.minutosEspera + ' minutos.'],
  { texto: 'Abrir la cola de mentoría', url: r.enlace }));`),
      [1720, 500],
    );
    f.unir(ok, esperar);
    f.cadena(esperar, firmarE, appE, escalar);
    f.envios(escalar, " (escalamiento)", 1960, 500);
    flujos.push(f);
  }

  // WF-08 · Comunicados.
  {
    const f = new Flujo("WF-08-comunicados", "WF-08 · Comunicados");
    const ok = f.entradaFirmada(["announcement.created"]);
    const redactar = f.codigo(
      "Redactar comunicado",
      jsRedactar(`${EVENTO}
const a = p.alcance || {};
const ALCANCE = a.tipo === 'track' ? 'track ' + a.track : a.tipo === 'equipo' ? 'equipo ' + a.teamId : 'todos';
const parrafos = String(p.mensaje).split(/\\n{2,}/).map((x) => esc(x).replace(/\\n/g, '<br>'));
salida.push(...correoACada(p.destinatarios, 'Comunicado · Hackathon EduTech', 'Comunicado de la organización', parrafos));
salida.push(slack('📣 Comunicado (' + ALCANCE + ', ' + (p.destinatarios || []).length + ' personas):\\n' + p.mensaje));`),
      [1000, 200],
    );
    f.unir(ok, redactar);
    f.envios(redactar, "", 1240, 200);
    flujos.push(f);
  }

  // WF-09 · Resultados y certificados.
  {
    const f = new Flujo("WF-09-resultados-certificados", "WF-09 · Resultados y certificados");
    const ok = f.entradaFirmada(["results.published"]);
    const equipos = f.codigo(
      "Un ítem por equipo",
      `return $('Verificar firma').first().json.evento.payload.equipos.map((t) => ({ json: { contexto: t, peticion: { consulta: 'retroalimentacion', teamId: t.teamId } } }));`,
      [1000, 200],
    );
    const firmarR = f.codigo("Firmar consulta de retroalimentación", jsFirmar("item.json.peticion"), [1240, 200]);
    const appR = f.llamarApp("Retroalimentación del jurado", "/api/n8n/consulta", [1480, 200]);
    const preparar = f.codigo(
      "Un ítem por integrante",
      `// Combina cada equipo con su retroalimentación (mismo orden que "Firmar consulta de retroalimentación").
const firmados = $('Firmar consulta de retroalimentación').all();
const salida = [];
$input.all().forEach((item, i) => {
  const t = firmados[i].json.contexto;
  const fb = item.json.publicado ? item.json : { fortalezas: [], recomendaciones: [] };
  const tipo = t.premios.length ? 'ganador' : t.finalista ? 'finalista' : 'participacion';
  for (const m of t.integrantes) {
    if (!m.email) continue;
    salida.push({ json: {
      contexto: { para: m.email, nombre: m.nombre, equipo: t.nombre, tipo, premios: t.premios, posicionFinal: t.posicionFinal, fortalezas: fb.fortalezas, recomendaciones: fb.recomendaciones },
      peticion: { nombre: m.nombre, equipo: t.nombre, tipo, premio: t.premios.join(', ') || null },
    } });
  }
});
return salida;`,
      [1720, 200],
    );
    const firmarC = f.codigo("Firmar certificado", jsFirmar("item.json.peticion"), [1960, 200]);
    const appC = f.llamarApp("Generar certificado PDF", "/api/n8n/certificado", [2200, 200], true);
    const redactar = f.codigo(
      "Redactar correo con certificado",
      jsRedactar(`const firmados = $('Firmar certificado').all();
const items = $input.all();
for (let i = 0; i < items.length; i++) {
  const c = firmados[i].json.contexto;
  const pdf = (await this.helpers.getBinaryDataBuffer(i, 'data')).toString('base64');
  const lista = (xs) => xs.length ? '<ul>' + xs.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '<p>—</p>';
  const logro = c.tipo === 'ganador' ? '¡Felicitaciones! Tu equipo obtuvo: <strong>' + esc(c.premios.join(', ')) + '</strong>.'
    : c.tipo === 'finalista' ? 'Tu equipo llegó a la final' + (c.posicionFinal ? ' (puesto ' + c.posicionFinal + ')' : '') + '.'
    : 'Gracias por construir en vivo con nosotros.';
  const item = correo(c.para, 'Resultados y certificado · Hackathon EduTech', 'Resultados del Hackathon EduTech',
    ['Hola ' + esc(c.nombre) + ', ya están publicados los resultados. ' + logro,
     '<strong>Fortalezas que vio el jurado en ' + esc(c.equipo) + ':</strong>' + lista(c.fortalezas),
     '<strong>Recomendaciones para seguir:</strong>' + lista(c.recomendaciones),
     'Adjuntamos tu certificado en PDF.'],
    { texto: 'Ver resultados', url: APP + '/resultados' });
  item.json.adjuntos = [{ filename: 'certificado-edutech-2026.pdf', content: pdf }];
  // Además como binario, para proveedores de correo que adjuntan desde binarios (Gmail en n8n).
  item.binary = { certificado: { data: pdf, mimeType: 'application/pdf', fileName: 'certificado-edutech-2026.pdf' } };
  salida.push(item);
}
salida.push(slack('Resultados publicados: ' + items.length + ' certificados enviados por correo.'));`),
      [2440, 200],
    );
    f.cadena(ok, equipos, firmarR, appR, preparar, firmarC, appC, redactar);
    f.envios(redactar, "", 2680, 200);
    flujos.push(f);
  }

  // WF-99 · Reporte de errores (basado en la plantilla 2159 de n8n). Los demás workflows lo usan como
  // "Error workflow" cuando se despliegan con scripts/n8n-desplegar.ts.
  {
    const f = new Flujo("WF-99-reporte-errores", "WF-99 · Reporte de errores");
    const disparador = f.nodo({ name: "Error en un workflow", type: "n8n-nodes-base.errorTrigger", typeVersion: 1, position: [0, 300], parameters: {} });
    const redactar = f.codigo(
      "Redactar aviso de error",
      jsRedactar(`const e = $input.first().json;
const wf = (e.workflow && e.workflow.name) || 'workflow desconocido';
const nodo = (e.execution && e.execution.lastNodeExecuted) || 'nodo desconocido';
const error = String((e.execution && e.execution.error && e.execution.error.message) || 'sin detalle').slice(0, 300);
const url = (e.execution && e.execution.url) || '';
salida.push(slack('🚨 Falló ' + wf + ' en el nodo «' + nodo + '»: ' + error + (url ? '\\n' + url : '')));`),
      [240, 300],
    );
    f.cadena(disparador, redactar);
    f.envios(redactar, "", 480, 300);
    flujos.push(f);
  }

  return flujos;
}

// Ejecutado directamente: escribe los JSON.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.join(process.cwd(), "n8n", "workflows");
  mkdirSync(dir, { recursive: true });
  for (const f of construirWorkflows()) {
    writeFileSync(path.join(dir, `${f.archivo}.json`), `${JSON.stringify(f.json(), null, 2)}\n`);
    console.log(`n8n/workflows/${f.archivo}.json · ${f.nodos.length} nodos`);
  }
}
