# Workflows de n8n

Diez workflows importables que conectan la plataforma con correo (Resend) y Slack. Los nueve del
plan (WF-01 a WF-09) más WF-00, que reintenta los eventos que n8n no recibió.

> Los JSON se **generan** con `npm run n8n:generar` desde `scripts/generar-workflows.ts`. No los
> edites a mano: cambia el generador y vuelve a generarlos, así los diez comparten el mismo código
> de firma y de envío.

| ID | Workflow | Disparador | Qué hace |
| --- | --- | --- | --- |
| WF-00 | Reintento de eventos | Cada 5 min | `POST /api/eventos/reintentar`; avisa en Slack si algún evento falló 10 veces |
| WF-01 | Confirmación de inscripción | Webhooks `registration.created`, `guardian.validated`, `checkin.created` | Correo de bienvenida con próximos pasos (y recordatorio de autorización si es Junior); correo con la decisión sobre la autorización; aviso en Slack de inscripciones y check-in Junior |
| WF-02 | Invitaciones de equipo | Webhooks `team.invitation`, `team.completed` | Correo con código y enlace; aviso en Slack cuando un equipo alcanza el mínimo |
| WF-03 | Recordatorios de convocatoria | Cada día 09:00 | Autorizaciones pendientes, equipos incompletos e invitación al webinar (la app decide si la convocatoria sigue abierta) |
| WF-04 | Monitor de repositorios | Cada 15 min, vie 15:30 → sáb 12:00 | `POST /api/github/snapshot {todos:true}`; alertas rojas nuevas a Slack y a la mesa técnica (sin repetir) |
| WF-05 | Recordatorio de checkpoints | Vie 18:30, sáb 10:00 y 11:30 | Correo a los equipos en riesgo 30 min antes del checkpoint 1, el checkpoint 2 y el freeze |
| WF-06 | Validación de entregas | Sáb 12:05 + webhook `submission.created` | Snapshot final y reporte A1–A5 al comité; acuse de recibo de cada entrega al equipo |
| WF-07 | Mentoría | Webhook `mentor.requested` | Correo a los mentores del tema y aviso en Slack; a los 30 min, si sigue abierta, escala a la mesa técnica |
| WF-08 | Comunicados | Webhook `announcement.created` | Un correo por destinatario y copia en Slack |
| WF-09 | Resultados y certificados | Webhook `results.published` | Certificado PDF por integrante (participación, finalista o ganador) con la retroalimentación del jurado |

## Cómo se comunican la app y n8n

```
app ──POST {N8N_WEBHOOK_BASE_URL}/<evento>──▶ n8n     (X-Timestamp + X-Signature)
n8n ──POST {EDUTECH_APP_URL}/api/...────────▶ app     (X-Timestamp + X-Signature)
```

- Firma: `X-Signature: sha256=<hex>` = HMAC-SHA256(secreto, `${X-Timestamp}.${cuerpo}`), con
  ventana de ±5 minutos (`lib/hmac.ts`, D-18). Se firma el cuerpo **crudo**: el webhook tiene
  activada la opción *Raw Body* y el nodo "Verificar firma" usa esos bytes.
- Toda petición sin firma válida recibe 401 y no dispara ningún envío.
- La app guarda cada evento en `event_outbox` antes de enviarlo (D-19). Si n8n no responde, WF-00
  lo reintenta. La entrega es *al menos una vez*: en un caso raro (timeout justo después de que
  n8n recibió el evento) un correo puede llegar dos veces.

Endpoints de la app para n8n (todos `POST`, firmados):

| Ruta | Cuerpo | Lo usa |
| --- | --- | --- |
| `/api/github/snapshot` | `{"todos":true}` o `{"teamId":"slug"}` | WF-04, WF-06 |
| `/api/n8n/consulta` | `{"consulta":"recordatorios-convocatoria"}` | WF-03 |
| | `{"consulta":"checkpoints-en-riesgo","hito":"checkpoint1\|checkpoint2\|freeze"}` | WF-05 |
| | `{"consulta":"reporte-entregas"}` | WF-06 |
| | `{"consulta":"mentores","tema":"producto\|tecnica\|n8n\|ia\|pitch"}` | WF-07 |
| | `{"consulta":"mentoria-estado","requestId":"…"}` | WF-07 |
| | `{"consulta":"retroalimentacion","teamId":"slug"}` | WF-09 |
| `/api/n8n/certificado` | `{"nombre","equipo","tipo","premio"?}` → PDF | WF-09 |
| `/api/eventos/reintentar` | `{}` | WF-00 |

## Instalación

Requiere n8n 1.x (self-hosted o Cloud con acceso a variables de entorno).

### 1. Variables de entorno de n8n

```bash
# Permitir require('crypto') en los nodos Code y leer $env
NODE_FUNCTION_ALLOW_BUILTIN=crypto
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
GENERIC_TIMEZONE=America/Guayaquil

EDUTECH_APP_URL=https://<dominio-de-la-app>          # sin barra final
EDUTECH_SHARED_SECRET=<el mismo valor que N8N_SHARED_SECRET de la app>
EDUTECH_CORREO_REMITENTE="Hackathon EduTech <hackathon@<dominio verificado en Resend>>"
EDUTECH_CORREO_COMITE=<correo del comité>
EDUTECH_CORREO_MESA_TECNICA=<correo de la mesa técnica>
EDUTECH_SLACK_CANAL_STAFF=<ID del canal, p. ej. C0123456789>
```

Genera el secreto con `openssl rand -hex 32` y guárdalo solo en n8n y en `.env.local` / Netlify.

### 2. Credenciales (Settings → Credentials)

| Nombre exacto | Tipo | Valor |
| --- | --- | --- |
| `Resend API` | Header Auth | Name: `Authorization` · Value: `Bearer <RESEND_API_KEY>` |
| `Slack EduTech` | Slack API | Token de un bot con `chat:write`, invitado al canal del staff |

Los JSON solo traen la **referencia** a la credencial (`id` + `name`), nunca el valor.

### 3. Importar

En n8n: *Workflows → Import from File* y elige cada `workflows/WF-*.json`. Al abrir cada uno,
selecciona las credenciales `Resend API` y `Slack EduTech` en los nodos marcados en rojo.

### 4. Conectar la app

En la app (`.env.local` o variables de Netlify):

```bash
N8N_WEBHOOK_BASE_URL=https://<tu-n8n>/webhook   # la app agrega /<evento>
N8N_SHARED_SECRET=<mismo valor que EDUTECH_SHARED_SECRET>
```

### 5. Activar

Activa los diez workflows. Los webhooks quedan en `https://<tu-n8n>/webhook/<evento>`
(p. ej. `/webhook/registration.created`).

## Fechas

Los workflows programados tienen las horas del evento en su cron (zona America/Guayaquil):
WF-04 (vie 6 15:30 → sáb 7 12:00), WF-05 (18:30, 10:00, 11:30) y WF-06 (sáb 12:05). Si cambia
la agenda en `config/event.ts`, ajusta los cron en `scripts/generar-workflows.ts` y regenera.
WF-03 corre a diario, pero la app responde `activo:false` fuera de la convocatoria.

## Datos personales

- Las ejecuciones exitosas no se guardan (`saveDataSuccessExecution: none`): contienen correos.
  Las fallidas sí, para poder diagnosticarlas; bórralas tras el evento.
- Cada correo va a una sola persona: nadie ve las direcciones de los demás.
- Slack recibe nombres de equipo y conteos, nunca correos ni teléfonos.
- La app responde a cada consulta solo con lo necesario para ese envío (D-39).

## Pruebas

```bash
npm run n8n:test
```

Valida los JSON, levanta un servidor de prueba que ejecuta el código real de los workflows, envía
cada evento con el `emitEvent` de la app y verifica la firma en ambos sentidos (incluye rechazos
por cuerpo alterado, timestamp viejo y secreto distinto). Con la app corriendo puedes probar
también la vuelta real:

```bash
N8N_TEST_APP_URL=http://localhost:3000 N8N_TEST_APP_SECRET=<N8N_SHARED_SECRET de la app> npm run n8n:test
```

Los mismos escenarios corren en `npm test` (`tests/unit/n8n.test.ts`).
