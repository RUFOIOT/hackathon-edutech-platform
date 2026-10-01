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
