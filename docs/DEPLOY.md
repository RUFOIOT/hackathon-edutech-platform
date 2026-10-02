# Despliegue

## Estado actual

| Recurso | Valor | Estado |
| --- | --- | --- |
| Repositorio | https://github.com/RUFOIOT/hackathon-edutech-platform | Listo |
| GitHub Pages | https://rufoiot.github.io/hackathon-edutech-platform/ | Publicado (se reconstruye cada día) |
| Netlify | sitio `edutech-hackathon-2026` → https://edutech-hackathon-2026.netlify.app | Desplegado |
| Firebase | proyecto `edutech-hackathon-2026` (Firestore en `nam5`) | Reglas e índices publicados |
| n8n | https://cyberdog87.app.n8n.cloud (WF-00…WF-09 y WF-99) | Activo |
| App web de Firebase | `1:998617029548:web:703bb14bf221e3a2c2f809` | Configurada en Netlify |

Variables ya cargadas en Netlify: `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `APP_BASE_URL`, `NEXT_PUBLIC_FIREBASE_*`,
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`, `FIREBASE_PROJECT_ID`, `GITHUB_ORG` y los secretos
`CHECKIN_QR_SECRET`, `N8N_SHARED_SECRET` y `HASH_SALT` (generados al azar, solo en Netlify).

Pendiente:

- [x] `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` (cuenta de servicio) en Netlify.
- [x] Authentication → acceso por enlace de correo y dominio `edutech-hackathon-2026.netlify.app` autorizado.
- [x] Prueba en producción (02-oct-2026): token de Auth → sesión en Netlify → página privada →
  escritura en Firestore desde Netlify. Cuenta admin inicial creada en `staff/`.
- [x] Prueba de registro en producción (02-oct-2026, con `INSCRIPCIONES_PRUEBA`): inscripción de un
  equipo, QR y check-in. Inscripciones cerradas de nuevo y datos de la prueba borrados (solo queda
  la cuenta admin en `staff/`).
- [ ] **Bloqueante para Junior y para la entrega:** activar el plan Blaze y crear Storage (el bucket
  `edutech-hackathon-2026.firebasestorage.app` no existe todavía); luego `firebase deploy --only storage`.
- [ ] Rotar la clave de la cuenta de servicio (la primera pasó por la sesión de configuración).
- [ ] Plan Blaze, Storage y `firebase deploy --only storage`.
- [x] n8n Cloud (`cyberdog87.app.n8n.cloud`): 11 workflows activos con `npm run n8n:desplegar`
  (correo por la credencial Gmail de n8n; avisos al staff por correo hasta configurar Telegram).
  `N8N_WEBHOOK_BASE_URL` cargada en Netlify. Prueba real: evento del outbox enviado por Netlify →
  firma aceptada en n8n; firma falsa → 401.
- [ ] Telegram para los avisos al staff (opcional): `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en `.env.n8n`.
- [ ] GitHub App (`GITHUB_APP_*`, `GITHUB_WEBHOOK_SECRET`).
- [ ] Variable `URL_PLATAFORMA` del repositorio cuando el ingreso funcione, para enlazar Pages con Netlify.

Ojo: las variables creadas con *scopes* personalizados o marcadas como secretas desde la API no
llegaron a guardarse en este plan de Netlify; se cargaron con el alcance por defecto (todos).

Netlify no está conectado al repositorio todavía: los despliegues se suben desde un clon limpio
(nunca desde la carpeta de trabajo, que tiene `.env.local` apuntando a los emuladores). Para
desplegar en cada push, conecta el repositorio en *Site configuration → Build & deploy*.

Dos piezas públicas:

| Pieza | Dónde | Qué incluye |
| --- | --- | --- |
| Web pública estática | GitHub Pages (`.github/workflows/pages.yml`) | Portada, tracks, guías, rúbrica, privacidad, dataset |
| App completa | Netlify + Firebase | Todo lo anterior + registro, portal, jurado, dashboard, API para n8n y GitHub |

Para el evento, la URL oficial debe ser la de **Netlify**. Pages sirve como vitrina mientras la
app no está publicada; cuando lo esté, define la variable `URL_PLATAFORMA` del repositorio para que
los botones de inscripción e ingreso de Pages apunten a ella.

## 1. Firebase (producción)

1. Crea el proyecto en la consola de Firebase y actívale el plan **Blaze** (Storage con URLs
   firmadas y la cuenta de servicio lo necesitan; el costo esperado para 150 personas es mínimo).
2. **Authentication** → Método de acceso → *Correo electrónico/contraseña* con **Vínculo de
   correo electrónico (acceso sin contraseña)**. En *Dominios autorizados* agrega el dominio de
   Netlify y el dominio propio, si lo hay.
3. **Firestore** en modo producción, región `southamerica-east1` (São Paulo) o `us-east1`.
4. **Storage** con el bucket por defecto.
5. Publica reglas e índices:
   ```bash
   npx firebase-tools@15 login
   npx firebase-tools@15 use prod   # edutech-hackathon-2026 (ver .firebaserc)
   npx firebase-tools@15 deploy --only firestore:rules,firestore:indexes,storage
   ```
6. CORS del bucket (subida directa del pitch con URL firmada, D-25). Guarda como `cors.json`:
   ```json
   [{ "origin": ["https://<tu-dominio>"], "method": ["PUT"], "responseHeader": ["Content-Type", "x-goog-content-length-range"], "maxAgeSeconds": 600 }]
   ```
   y aplica: `gcloud storage buckets update gs://<bucket> --cors-file=cors.json`.
7. TTL de los contadores del límite de peticiones:
   `gcloud firestore fields ttls update expiraAt --collection-group=rate_limits --enable-ttl`.
8. Cuenta de servicio: *Configuración del proyecto → Cuentas de servicio → Generar nueva clave*.
   Copia `project_id`, `client_email` y `private_key` a las variables de Netlify (no al repositorio).

## 2. GitHub

Sigue `scripts/setup-org.md`: organización `eight-academy-hackathon`, repositorio plantilla
`edutech-2026-template` (desde `template-repo/`) y una **GitHub App** instalada en la organización
con permisos de lectura de contenido y metadatos, y el webhook hacia
`https://<tu-dominio>/api/github/webhook` (eventos `push` y `create`).

## 3. Netlify

1. *Add new site → Import from Git* y elige este repositorio. `netlify.toml` ya define el build
   (`npm run build`) y el plugin de Next.js.
2. Variables de entorno (*Site configuration → Environment variables*), todas marcadas como
   secretas salvo las `NEXT_PUBLIC_*`:

| Variable | Valor |
| --- | --- |
| `APP_BASE_URL` | `https://<tu-dominio>` |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_STORAGE_BUCKET`, `…_APP_ID` | Configuración web de Firebase |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | `false` |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Cuenta de servicio (la clave en una línea con `\n`) |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_WEBHOOK_SECRET` | GitHub App |
| `GITHUB_ORG` | `eight-academy-hackathon` |
| `CHECKIN_QR_SECRET` | `openssl rand -hex 32` |
| `N8N_WEBHOOK_BASE_URL`, `N8N_SHARED_SECRET` | Ver `n8n/README.md` |
| `HASH_SALT` | `openssl rand -hex 16` (sal del hash de IP del limitador) |
| `RETENCION_MESES` | Opcional; 12 por defecto |

   **No** definas `APP_FECHA_SIMULADA` ni `FIRESTORE_EMULATOR_HOST` en producción.
3. Despliega y verifica: `/` responde, `/ingresar` envía el enlace, las cabeceras incluyen
   `Content-Security-Policy` (`curl -I https://<tu-dominio>`).
4. Dominio propio (opcional): *Domain management* y agrégalo también a los dominios autorizados de
   Firebase Auth y al CORS del bucket.

## 4. n8n y correo

1. En Resend, verifica el dominio remitente (registros DNS SPF y DKIM).
2. Instala los workflows siguiendo `n8n/README.md` y apunta `EDUTECH_APP_URL` a Netlify.
3. Prueba la ida y vuelta:
   `N8N_TEST_APP_URL=https://<tu-dominio> N8N_TEST_APP_SECRET=<secreto> npm run n8n:test`.

## 5. GitHub Pages (web pública estática)

1. En el repositorio: *Settings → Pages → Build and deployment → Source: GitHub Actions*.
2. Cada push a `main` (y cada día a las 06:00 de Ecuador) ejecuta `npm run build:pages` y publica
   en `https://<usuario>.github.io/<repositorio>/`.
3. Cuando la app de Netlify esté publicada: *Settings → Secrets and variables → Actions →
   Variables* → `URL_PLATAFORMA = https://<tu-dominio>` y vuelve a ejecutar el workflow.

Para probarlo en local: `BASE_PATH=/hackathon-edutech-platform npm run build:pages` y sirve
`out-pages/` bajo esa ruta.

## Antes de abrir inscripciones

- [ ] Datos `POR_CONFIRMAR` de `config/event.ts` revisados con el comité.
- [ ] Textos de consentimiento y `/privacidad` revisados por asesoría legal y DECE.
- [ ] `npm run test:all` en verde y `npm run ensayo` ejecutado contra un entorno de prueba.
- [ ] Cuentas de staff creadas (`staff/{uid}` con sus roles) y jurado cargado.
- [ ] Workflows de n8n activos y un correo de prueba recibido.
