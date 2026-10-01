# Decisiones técnicas

Registro de decisiones no cubiertas por el prompt o que lo modifican. Formato: contexto → decisión → consecuencias.

## D-01 · Firebase en lugar de Supabase

**Contexto.** El prompt pedía Supabase (PostgreSQL, RLS, Storage, Realtime). El responsable del
proyecto pidió usar Firebase (1 oct 2026).

**Decisión.** Firebase Auth (enlace mágico por correo), Cloud Firestore, Firebase Storage y los
Firebase Emulators para desarrollo local y CI.

**Equivalencias con el prompt.**

| Prompt (Supabase) | Implementación (Firebase) |
|---|---|
| `supabase/migrations/*.sql` | `firestore.rules`, `firestore.indexes.json`, `storage.rules` versionados; el esquema vive en `lib/models/tipos.ts` |
| Row Level Security | Reglas de seguridad de Firestore + tests en `tests/rules/` |
| Triggers de auditoría | `auditarEn()` en el mismo batch de cada escritura (D-03) |
| Funciones SQL `score_total`, `room_normalization`, `tiebreak` | Funciones TypeScript puras con tests (Fase 5) |
| Vista SQL `v_dashboard_dataset` | Generador del dataset en el servidor con el mismo esquema plano, documentado en `docs/DATASET.md` (Fase 6) |
| Supabase Realtime | `onSnapshot` del SDK cliente sobre colecciones que las reglas permiten leer |
| `supabase/seed.sql` | `scripts/seed.ts` contra los emuladores |
| Variables `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` | `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |

**Consecuencias.**

- Firestore no tiene joins ni agregaciones arbitrarias: los KPIs del dashboard se calculan en el
  servidor y algunos campos se denormalizan (p. ej. `teams.roomId` para que las reglas del jurado
  no necesiten consultas).
- El correo del enlace mágico lo envía Firebase Auth, no Resend. Su plantilla se edita en la
  consola de Firebase (Authentication → Plantillas). Resend sigue usándose desde n8n para el resto.
- La detección de secretos del template-repo busca también claves de servicio de Firebase.
- La auditoría depende de usar `auditarEn()` en cada escritura sensible. Si se necesita una
  garantía a nivel de base, se puede añadir una Cloud Function `onDocumentWritten`, que requiere el
  plan Blaze.

## D-02 · El SDK cliente solo lee

Toda escritura pasa por el servidor (Server Actions o rutas API) con firebase-admin. Las reglas
niegan `write` en todas las colecciones. Así la validación con Zod, las reglas de negocio (tamaño
de equipo, ventanas de tiempo, bloqueo de puntajes por sala) y la auditoría viven en un solo lugar,
y las reglas solo resuelven quién puede leer qué. El cliente lee en tiempo real lo que las reglas
permiten (dashboard, cronómetro de `/pantalla`).

## D-03 · Auditoría en el mismo batch

Firestore no ejecuta triggers dentro de la base. `lib/audit.ts` añade la entrada de `audit_log`
al mismo `WriteBatch` o `Transaction` de la escritura: o se guardan ambas o ninguna. Solo admin y
comite leen `audit_log`.

## D-04 · GitHub App en lugar de token fine-grained

Tiene un límite de consultas propio por instalación, sus tokens caducan solos y trae un webhook de
organización nativo. Requiere que una persona con rol de owner de `eight-academy-hackathon` la cree
e instale (pasos en `scripts/setup-org.md`, Fase 4). Se añadió `GITHUB_APP_INSTALLATION_ID` a
`.env.example`.

## D-05 · Regla de no compensación por juez

La rúbrica dice "promedio de los jueces de esa sala, aplicando la regla de no compensación de C2"
sin precisar si el tope de 60 se aplica antes o después de promediar. Decisión del responsable:
**se aplica al puntaje de cada juez** que asigna C2 = 1, y luego se promedia. Es más estricto y
cada puntaje individual es auditable.

## D-06 · Next.js 15.5

El prompt pide 14+. Se usa 15.5 (estable, compatible con `@netlify/plugin-nextjs`). ESLint se
ejecuta con la CLI (`eslint .`) porque `next lint` está deprecado.

## D-07 · Sesión con cookie de sesión de Firebase

El enlace mágico se completa en el navegador. El ID token (emitido hace menos de 5 minutos) se
cambia en `/api/auth/session` por una cookie de sesión httpOnly `__session` de 5 días, revocable,
y se cierra la sesión del SDK cliente. La ruta verifica que el `Origin` sea el de la app (CSRF).
El parámetro `siguiente` se valida contra redirecciones abiertas (`destinoSeguro`).
`middleware.ts` (edge) solo comprueba que la cookie exista; firebase-admin no corre en el edge.

## D-08 · Fechas y edad

Todas las fechas de `config/event.ts` llevan el offset `-05:00` (Ecuador no tiene horario de
verano). La categoría se calcula con la edad cumplida **al día del kick-off**, usando la fecha
civil de Ecuador. Las fechas de convocatoria están entre corchetes en la guía: se usan las
propuestas con `confirmada: false`.

## D-09 · Categoría de equipo MIXTO

La guía define categorías por persona. Para el equipo se calcula JUNIOR (todos Junior), OPEN
(todos Open) o MIXTO. El premio "Mejor equipo Junior" exige equipos 100 % Junior (rúbrica §7).

## D-10 · Storage cerrado al cliente

`storage.rules` niega todo. Los PDFs de pitch y las autorizaciones de menores se suben por el
servidor y se descargan con URLs firmadas de corta duración, emitidas solo a roles autorizados.

## D-11 · Tailwind CSS 4

Los tokens se definen en CSS con `@theme` (`app/globals.css`), sin `tailwind.config`. Hay dos
capas: tokens de marca (`navy-900`, `brass-500`…) y tokens semánticos (`bg`, `fg`, `accent`…)
que se redefinen en modo oscuro.

## D-12 · Contraste del brass

Brass `#B8893B` sobre `paper-50` da un contraste de 2,9:1, insuficiente para texto normal según
AA. Se usa como fondo de CTAs con texto `navy-900` (5,4:1) y, para texto sobre fondo claro, la
variante `accent-text` `#82601F` (5,4:1). Verificado sobre `paper-50`: `muted` 6,8:1, `danger`
4,8:1, `positive-text` 5,9:1. En modo oscuro: `muted` 8,6:1, `accent-text` 8,7:1, `danger` 6,5:1.

## D-13 · Publicación de las guías: contenido interno y corchetes

La guía dice que "los campos entre corchetes son decisiones institucionales pendientes. No se
publican hasta estar confirmados". Al renderizar `/guia`, `/guia-hacker` y `/rubrica`,
`prepararParaPublicar()` (`lib/content/markdown.ts`), sin modificar los `.md`:

- Quita lo interno: los metadatos del borrador (Versión, Responsable), la nota sobre los corchetes,
  la alerta de calendario del POA y la sección "Decisiones pendientes antes de abrir la convocatoria".
- Una celda pendiente (`[MONTO USD]`, `[LISTA]`, `[CONFIRMAR]`) se muestra como "Por anunciar".
- Una nota pendiente detrás de un valor (`n8n · [CONFIRMAR acuerdo…]`) o el marcador
  `[CONFIRMAR]` al inicio de una frase se muestran como "(por confirmar)". Los añadidos
  `[+ CONFIRMAR …]` se omiten.
- Las fechas propuestas (`[28 oct]`) se muestran como "28 oct (por confirmar)".
- La cláusula de propiedad intelectual se publica con la nota "(texto sujeto a revisión legal)".

Cuando el comité confirme un dato, basta con editar el `.md`: el corchete desaparece y el valor se
publica tal cual.

## D-14 · Portada regenerada cada 5 minutos

La portada es estática con `revalidate = 300`: el bloque de inscripciones (abren el…, abiertas,
cerradas) depende de la fecha. La cuenta regresiva se calcula en el navegador con una resta de
instantes, así que es correcta en cualquier zona horaria. El servidor pinta guiones del mismo ancho
para evitar saltos de diseño (CLS = 0).

## D-15 · Tests e2e contra el build de producción

Playwright levanta `npm run build && next start` en el puerto 3100 y prueba dos perfiles: móvil
de 360 px y escritorio. Verifica la cuenta regresiva con reloj simulado y el navegador en Tokio,
`prefers-reduced-motion`, que solo el infinito se anime, la ausencia de desplazamiento horizontal,
las anclas del índice y que no se publiquen notas internas.

## D-16 · Reloj simulable solo con emuladores

`lib/event/reloj.ts` (`ahora()`) devuelve la hora real, salvo que `APP_FECHA_SIMULADA` esté
definida **y** la app apunte a los emuladores (`FIRESTORE_EMULATOR_HOST`). Sirve para los tests e2e
(hoy, 1 oct, las inscripciones aún no abren) y para el ensayo del runbook. Un despliegue real nunca
define `FIRESTORE_EMULATOR_HOST`, así que la simulación no puede activarse en producción.

## D-17 · Límite de archivos en Server Actions (Netlify)

Netlify limita el cuerpo de una función a unos 6 MB. La autorización Junior se sube en la Server
Action con un máximo de **4 MB** (`bodySizeLimit: 5mb`), validando que sea un PDF real (cabecera
`%PDF-`). El PDF del pitch (hasta 20 MB, Fase 4) **no** puede pasar por una función: se subirá
directo a Storage con una URL firmada de subida emitida por el servidor.

## D-18 · Firma HMAC sobre timestamp y cuerpo

`X-Signature: sha256=<hex>` es el HMAC-SHA256 de `${X-Timestamp}.${cuerpo}`, no solo del cuerpo.
Así un cuerpo firmado no puede reenviarse con otro timestamp para burlar la ventana de 5 minutos.
La verificación usa comparación en tiempo constante. Los workflows de n8n (Fase 7) verifican con la
misma fórmula.

## D-19 · Outbox de eventos hacia n8n

Cada evento se escribe en `event_outbox` dentro de la misma transacción que el cambio que lo
origina, y se envía después del commit. Si n8n no responde, el evento queda `pendiente` con su
error y se reintenta (endpoint de reintento en la Fase 7). Así una caída de n8n no bloquea
inscripciones ni pierde correos.

## D-20 · Lista de espera

El cupo se controla con contadores en `stats/inscripciones`, actualizados en la misma transacción
que la inscripción, así que dos inscripciones simultáneas no pueden pasarse del cupo. Quien entra
con el cupo lleno queda en lista de espera: se guarda su inscripción y lo que pidió
(`solicitudEquipo`), pero **no** crea equipo ni se une a uno. La organización lo atiende desde
`/admin/participantes` (Fase 6).

## D-21 · Equipos con integrantes Junior

La guía exige un "mentor adulto asignado" por la organización. La inscripción marca
`requiereAdulto` en el equipo y `/mi-equipo` lo muestra como pendiente. La organización asigna
`adultoResponsableId` desde `/admin/equipos` (Fase 6). El registro no puede exigirlo de entrada
porque lo asigna la organización.

## D-22 · Invitaciones y tamaño de equipo

El código de invitación es por equipo: 6 caracteres sin letras ambiguas (sin O, 0, I ni 1) para
dictarlo sin errores. Las invitaciones pendientes cuentan para el máximo de 5. El evento
`team.completed` se emite cuando el equipo llega al mínimo de 2 integrantes. Una persona solo puede
estar en un equipo: participants está indexado por uid y la unión se valida en transacción.

## D-23 · Verificación del usuario de GitHub sin bloqueo

Si GitHub responde 404, el paso 2 se rechaza con un mensaje claro. Si GitHub no responde o limita
la cuota, la inscripción sigue y queda marcada `githubVerificado: "sin-verificar"` para revisión
de la mesa técnica.

## D-24 · Consentimientos con texto exacto

Cada consentimiento guarda su tipo, la versión (`2026-10-v1`), el **texto exacto** aceptado, la
fecha y la IP. Los textos están en `lib/content/consentimientos.ts` como borrador, pendientes de
revisión legal y del DECE. La plantilla de autorización (`public/plantilla-autorizacion.pdf`) se
genera con `npm run plantilla:autorizacion` y dice "BORRADOR" hasta que se apruebe el formato
(guía §12, decisión 6).

## D-25 · Subida del pitch: URL firmada en producción, por el servidor con emuladores

El PDF del pitch (hasta 20 MB) no cabe en una función de Netlify (D-17). En producción, el servidor
emite una URL firmada v4 de subida directa a Storage para `pitches/{teamId}.pdf`, válida 10 minutos
y con la cabecera `x-goog-content-length-range: 0,20971520`. Al entregar, el servidor verifica que
el archivo exista, pese 20 MB o menos y empiece con `%PDF-`. El emulador de Storage no firma URLs,
así que con emuladores (y solo entonces) la subida pasa por una Server Action. **Requiere configurar
CORS en el bucket** para PUT desde el dominio de la app (docs/DEPLOY.md, Fase 8).

## D-26 · Cliente de GitHub inyectable

`lib/github.ts` (`validateRepo`, `snapshotRepo`, `resolveDeliveryTag`, `calcularAdmisibilidad`) no
importa Octokit: recibe un `GitHubCliente`. En producción es `lib/github/cliente.ts` (Octokit con la
GitHub App) y en los tests unitarios un cliente simulado. En los e2e, Octokit apunta con
`GITHUB_API_BASE` a un servidor simulado.

## D-27 · Checkpoints con heurísticas, confirmados por la mesa técnica

- **Checkpoint 1:** debe haber un commit que toque `README.md` antes de las 19:00, y el README
  actual debe tener las secciones Problema, Usuario, Evidencia y Arquitectura con al menos 40
  caracteres propios cada una. Los marcadores `<!-- COMPLETAR -->` de la plantilla no cuentan, así
  que el README sin tocar nunca lo cumple (hay un test que lo verifica).
- **Checkpoint 2:** debe haber un commit en `src/` antes de las 10:30 y una sección "Cómo correrlo"
  completa. Son solo indicios: el snapshot marca `checkpoint2RequiereRevision` y la mesa técnica lo
  confirma.

## D-28 · Secretos: análisis rápido en la plataforma y gitleaks en la plantilla

Los snapshots analizan el árbol actual con patrones (sk-, ghp_/github_pat_, AKIA, PEM, cuenta de
servicio de Google, JWT con `role: service_role`) y alertan si hay un `.env` versionado. El
resultado se guarda por SHA de blob (`blob_scans`), así cada archivo se analiza una sola vez, y
los hallazgos se enmascaran: nunca se guarda el secreto. El Action de la plantilla corre gitleaks
v8.30.1 sobre **todo el historial**, con verificación del checksum del binario. Validado en local:
no reporta nada sobre la plantilla limpia y detecta un token de GitHub plantado.

## D-29 · Movimientos del tag de entrega

El webhook de la GitHub App registra cada push, create o delete del tag `entrega` en `tag_events`,
usando como id el `X-GitHub-Delivery`, así que un reintento de GitHub no duplica el registro. Si
ocurre después del code freeze, marca `submissions.tagMovidoTrasFreeze` y lo audita. Además,
`resolveDeliveryTag` compara el SHA actual con el registrado en la entrega, lo que detecta un tag
movido a un commit **anterior** al freeze aunque no haya llegado el webhook.

## Diferencias entre el prompt y las guías (gana la guía)

1. **Sede:** "Unidad Educativa Particular Eight Academy, sede La Prensa". La dirección y el aforo
   están por confirmar.
2. **Cruce con el POA:** el sábado 7 está asignado a la "1era Integración Padres" y el viernes 6
   es día lectivo. Bloquea la convocatoria (guía §12, decisiones 1 y 2).
3. **Desempate:** la guía añade un 4.º criterio, la votación del jurado de la final. Se registrará
   como una decisión manual del comité.
4. **Junior:** además del representante, la guía exige un *mentor adulto asignado*.
5. **Cupo:** es una propuesta (30 equipos / 150 personas) sujeta al aforo.
6. **Temas de mentoría:** producto, técnica, n8n, IA, pitch.
7. **Checkpoint 2** ("algo ejecutable de punta a punta") no se puede verificar automáticamente.
   El sistema marcará indicios (commits nuevos, `src/` no vacío, URL de demo o instrucciones en el
   README) y la mesa técnica lo confirmará a mano.
