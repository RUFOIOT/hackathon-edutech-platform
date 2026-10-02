# CLAUDE.md · Plataforma Hackathon EduTech Eight Academy by n8n

Web pública, registro, portal de equipos, jurado y dashboard 360 del evento (6–7 nov 2026, Quito).
Interfaz, comentarios clave y documentación en **español**.

## Fuente de verdad

`content/01_GUIA_HACKATHON.md`, `02_GUIA_HACKER.md`, `03_RUBRICA_EVALUACION.md`. Si el código o el
prompt contradicen una guía, gana la guía y se reporta. Datos institucionales pendientes viven en
`config/event.ts` como `POR_CONFIRMAR` y se muestran como "Por anunciar" (`mostrar()`). Nunca
inventar montos, auspiciantes, direcciones ni nombres de jurado.

## Stack

Next.js 15 (App Router, Server Actions) · TypeScript estricto · Tailwind CSS 4 (tokens en
`app/globals.css`) · **Firebase** (Auth con enlace mágico, Firestore, Storage) · Zod · Vitest ·
Netlify. Ver `docs/DECISIONES.md` para el porqué de cada elección.

## Comandos

```bash
npm run dev          # Next en :3000 (usa .env.local)
npm run emulators    # Auth :9099, Firestore :8080, Storage :9199, UI :4000 (persiste en .firebase-data/)
npm run seed         # datos ficticios en los emuladores (40 participantes, 10 equipos, 3 salas, 4 jueces)
npm run lint
npm run typecheck
npm test             # unitarios (Vitest, proyecto "unit")
npm run test:rules   # reglas de Firestore contra el emulador (proyecto "rules")
npm run test:e2e     # Playwright: emuladores + simulado n8n/GitHub (:3999) + build en :3100
npm run build
npm run dataset:verificar  # KPIs del dashboard vs. docs/kpis.sql (con emuladores + seed)
npm run n8n:generar  # regenera n8n/workflows/*.json desde scripts/generar-workflows.ts
npm run n8n:test     # firma de ida y vuelta con los workflows reales (servidor de prueba)
npm run ensayo       # checklist del runbook contra una instancia con seed (ENSAYO_APP_URL, ENSAYO_N8N_SECRET)
npm run build:pages  # web pública estática para GitHub Pages (BASE_PATH=/<repo>)
```

Los emuladores necesitan Java 21+. En este Mac: `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"`.

`.env.local` para emuladores: `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`,
`NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-edutech`, `NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key`,
`FIREBASE_PROJECT_ID=demo-edutech`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`,
`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`.

Para ingresar en local: `/ingresar` con cualquier `*@edutech.test` del seed (`staff-admin`,
`staff-comite`, `staff-tecnica`, `staff-checkin`, `staff-mentor`, `juez-1..4`, `p-001..p-040`).
El enlace mágico se imprime en la terminal de los emuladores.

## Arquitectura y convenciones

- **El cliente solo lee.** `firestore.rules` niega toda escritura desde el SDK cliente. Toda
  escritura va por Server Actions o rutas API con firebase-admin (`lib/firebase/admin.ts`),
  valida con Zod, verifica permisos en código y escribe `audit_log` en el **mismo batch** con
  `auditarEn()` (`lib/audit.ts`).
- **Reglas = RLS.** Cada cambio de permisos lleva su test en `tests/rules/`. Los roles de
  `/admin` están en `lib/auth/roles.ts` (`ACCESO_ADMIN`) y deben espejar `firestore.rules`.
- **Sesión:** cookie httpOnly `__session` (cookie de sesión de Firebase, 5 días, revocable).
  `middleware.ts` solo verifica que exista; la verificación real está en `lib/auth/session.ts`
  (`requireSesion`, `requireAdmin(ruta)`, `requireJuez`).
- **firebase-admin y el SDK cliente se inicializan de forma perezosa** (`adminDb()`, `clientAuth()`),
  para que `next build` no requiera credenciales.
- **Fechas:** ISO con offset `-05:00` en `config/event.ts`; nunca depender de la zona horaria del
  servidor. La categoría se calcula con la edad al kick-off (`lib/models/categoria.ts`).
- **Logs:** usar `log` de `lib/log.ts` (redacta correos, teléfonos y tokens). `console.log` está
  prohibido por ESLint fuera de `scripts/` y `tests/`.
- **Modelo de datos:** `lib/models/tipos.ts` (una interfaz por colección, con el formato del id).
- **Rúbrica:** `lib/models/rubrica.ts`; el tope por C2 = 1 se aplica por juez (D-05).
- **Guías públicas:** se renderizan desde `content/*.md` con `cargarGuia()`; los corchetes
  pendientes y las secciones internas se filtran al publicar (D-13). Agenda, FAQ, premios y tracks
  viven en `config/event.ts`.
- **Movimiento e identidad (D-38):** la portada es dinámica (`.mancha`, `.cinta`, `.revelar`,
  `.trazo-infinito`, `.borde-ocho` en `globals.css`; colores `ocho-*` y `n8n`). Todo se apaga con
  `prefers-reduced-motion` y un test e2e lo garantiza. Logos oficiales en `public/brand/`; fotos y
  videos solo con autorización de imagen, declarados en `config/medios.ts`.
- **Registro:** `lib/registro/servicio.ts` hace toda la inscripción en UNA transacción (cupo,
  equipo, invitaciones, consentimientos, auditoría y outbox). Los esquemas Zod de
  `lib/validation/registro.ts` se usan en el cliente y en el servidor. El borrador vive en
  `registration_drafts/{uid}`.
- **Eventos a n8n:** siempre con `encolarEn(tx, tipo, payload)` dentro de la transacción y
  `despachar()` después del commit (`lib/eventos.ts`). Nunca llamar a `emitEvent` suelto.
- **Hora del servidor:** usar `ahora()` (`lib/event/reloj.ts`), no `new Date()`, en reglas de negocio
  con fechas (permite simularla con emuladores, D-16).
- **GitHub:** la lógica vive en `lib/github.ts` y recibe un `GitHubCliente` inyectable (D-26). Los
  tests usan un cliente simulado; nunca llaman a la API real. La persistencia está en
  `lib/github/servicio.ts` y los endpoints para n8n y para la GitHub App en `app/api/github/*`.
- **Plantilla de equipos:** `template-repo/` (se publica con `scripts/setup-org.md`). Si cambian las
  secciones del README, actualizar `SECCIONES_CHECKPOINT1/2` en `lib/github.ts`.
- **Puntajes:** toda la aritmética vive en `lib/scoring.ts` (`scoreTotal`, `roomNormalization`,
  `tiebreak`, `seleccionarFinalistas`, `rankingFinal`, `calcularPremios`). La hoja del juez usa la
  misma función para el total en vivo. No dupliques fórmulas en otros archivos.
- **Jurado:** las escrituras pasan por `lib/jurado/servicio.ts`, que repite en código las reglas de
  acceso por sala/final de `firestore.rules`. Firestore no admite arrays anidados: aplánalos antes
  de guardarlos (pasó con la auditoría de empates).
- **Copys:** voz activa y desde el usuario ("Inscribir a mi equipo" → "Equipo inscrito"). Errores
  que dicen qué pasó y cómo corregirlo. Sin etiquetas en mayúsculas ni numeraciones decorativas.
- **Accesibilidad AA:** foco visible, contraste verificado (`accent-text` para texto en brass),
  formularios con `label`, `aria-invalid` y `role="alert"`. Responsive desde 360 px.
- **Dashboard:** el dataset plano (`lib/dashboard/dataset.ts`) es la única fuente de KPIs y
  exportaciones. Un KPI nuevo lleva su consulta en `docs/kpis.sql` (`-- kpi: ruta`). Contacto solo
  para admin; puntajes para admin y comité. Columnas documentadas en `docs/DATASET.md`.
- **n8n:** los workflows se generan (`scripts/generar-workflows.ts`, D-40); nunca edites los JSON a
  mano. n8n no lee Firestore: pide datos a la app por `/api/n8n/consulta` con firma (D-39). Un
  evento nuevo necesita su webhook en algún workflow (el test de cobertura lo exige).
- **Seguridad:** cabeceras y CSP en `next.config.ts` (D-42); toda entrada pública o acción sensible
  pasa por `limitar()` de `lib/seguridad/limite.ts` (D-41). Si agregas un origen externo (scripts,
  imágenes, APIs), actualiza la CSP.
- **Privacidad:** un campo personal nuevo en `participants` debe sumarse a `camposAnonimos()`
  (`lib/privacidad/retencion.ts`) y a `/privacidad` (D-43).
- **Sitio estático (Pages):** las páginas públicas no deben depender de Firebase ni de rutas
  dinámicas; usa `asset()` para archivos de `/public` y `enlacePlataforma()` para enlaces a
  registro, portal o resultados (`lib/sitio.ts`, D-44).
- **Commits:** Conventional Commits. Al cerrar cada fase: lint, typecheck, tests, commit y resumen.
- **Secretos:** solo en `.env.local` (git-ignored); documentar cada variable en `.env.example`.

## Estado por fase

- [x] Fase 1 · Fundaciones
- [x] Fase 2 · Web pública
- [x] Fase 3 · Registro y portal de equipos
- [x] Fase 4 · GitHub y entregas
- [x] Fase 5 · Jurado y resultados
- [x] Fase 6 · Dashboard 360 y exportaciones
- [x] Fase 7 · n8n
- [x] Fase 8 · Endurecimiento y despliegue
