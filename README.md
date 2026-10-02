# Plataforma · Hackathon EduTech Eight Academy by n8n

Plataforma del **Hackathon EduTech Eight Academy by n8n**: viernes 6 y sábado 7 de noviembre de
2026 en la Unidad Educativa Particular Eight Academy, sede La Prensa (Quito). Estudiantes,
universitarios y profesionales construyen en vivo soluciones para la educación en tres tracks,
más un premio transversal a la mejor automatización con n8n.

**Sitio público:** https://rufoiot.github.io/hackathon-edutech-platform/

| Módulo | Ruta | Para quién |
| --- | --- | --- |
| Web pública | `/`, `/tracks`, `/guia`, `/guia-hacker`, `/rubrica`, `/privacidad` | Todos |
| Registro por pasos | `/registro` | Participantes (equipo, individual o con código) |
| Portal del equipo | `/mi-equipo` | Integrantes: equipo, repositorio, mentoría, entrega, resultado, mis datos |
| Jurado | `/jurado` | Jueces (pensado para el celular) |
| Dashboard 360 | `/admin` | Comité, mesa técnica, check-in, mentores (cada rol ve lo suyo) |
| Proyector de sala | `/pantalla` | Salas del Show and Tell |
| Resultados | `/resultados` | Público, cuando el comité los publica |

> El sitio de GitHub Pages es la **versión estática** de la web pública. El registro, el portal,
> el jurado y el dashboard necesitan servidor y Firebase: se despliegan en Netlify
> ([docs/DEPLOY.md](docs/DEPLOY.md)).

## Qué hace

- **Registro** en 5 pasos con borrador guardado, cálculo de categoría Junior/Open por edad al
  kick-off, autorización firmada del representante para menores, consentimientos con versión,
  cupo y lista de espera, invitaciones con código.
- **GitHub**: valida el repositorio del equipo (organización, nombre, fecha de creación), toma
  snapshots (commits en la ventana, autores, archivos obligatorios, secretos expuestos), sigue los
  checkpoints y el tag `entrega` en tiempo real por webhook. Incluye la plantilla de repositorio
  (`template-repo/`) con su GitHub Action de verificación y gitleaks.
- **Jurado**: rúbrica C1–C6 con descriptores, regla de no compensación (C2 = 1 limita a 60),
  normalización por sala, desempates, conflictos de interés, cronómetro y bloqueo al cerrar la sala.
- **Dashboard 360** en tiempo real: KPIs de convocatoria, check-in, repositorios, mentoría,
  entregas y jurado, semáforo por equipo y exportación CSV/XLSX. Cada KPI se puede recalcular con
  SQL sobre la exportación ([docs/DATASET.md](docs/DATASET.md)).
- **n8n**: 10 workflows importables (correos por Resend, avisos en Slack, recordatorios,
  monitor de repositorios, reporte de entregas, mentoría con escalamiento, certificados PDF), con
  firma HMAC en ambos sentidos ([n8n/README.md](n8n/README.md)).
- **Protección de datos (LOPDP)**: finalidad explícita por consentimiento, acceso y eliminación
  desde el portal, anonimización a los 12 meses, autorizaciones de menores en almacenamiento
  privado, exportaciones sin contacto salvo para admin y registros sin correos ni teléfonos.
- **Dataset ficticio** de un colegio para construir sin datos reales:
  [`public/dataset-ficticio-colegio.zip`](public/dataset-ficticio-colegio.zip).

## Stack

Next.js 15 (App Router, Server Actions) · TypeScript estricto · Tailwind CSS 4 · Firebase (Auth con
enlace mágico, Firestore, Storage) · Zod · Recharts · Vitest · Playwright · n8n · Netlify.

## Arranque local

Requisitos: Node.js 20+ (CI usa 22) y Java 21+ para los emuladores de Firebase.

```bash
npm install
cp .env.example .env.local   # valores para emuladores: ver CLAUDE.md
npm run emulators            # terminal 1: Auth, Firestore y Storage locales
npm run seed                 # terminal 2, una vez: 40 participantes, 10 equipos, 3 salas, 4 jueces
npm run dev                  # → http://localhost:3000
```

Ingresa en `/ingresar` con un correo del seed (`staff-admin@edutech.test`, `juez-1@edutech.test`,
`p-001@edutech.test`…). El enlace mágico aparece en la terminal de los emuladores.

Para ensayar otra fase del evento, define `APP_FECHA_SIMULADA` (solo funciona con emuladores), por
ejemplo `2026-11-07T11:00:00-05:00` para estar en plena ventana de hacking.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run lint` · `npm run typecheck` | ESLint sin advertencias y TypeScript estricto |
| `npm test` | Pruebas unitarias (puntajes, KPIs, firmas, workflows de n8n, límites, retención…) |
| `npm run test:rules` | Reglas de seguridad de Firestore contra el emulador |
| `npm run test:e2e` | Playwright contra el build de producción, con emuladores y GitHub/n8n simulados |
| `npm run dataset:verificar` | Compara cada KPI del dashboard con su consulta SQL |
| `npm run n8n:generar` · `npm run n8n:test` | Genera los workflows y prueba la firma de ida y vuelta |
| `npm run ensayo` | Recorre el checklist del runbook contra una instancia con el seed |
| `npm run dataset:colegio` | Regenera el dataset ficticio del colegio |
| `npm run build:pages` | Exporta la web pública estática para GitHub Pages |

## Estructura

```
app/            rutas (públicas, registro, mi-equipo, jurado, admin, api)
components/     componentes de interfaz
config/         event.ts (fechas, tracks, premios, agenda) y medios.ts
content/        guías oficiales en Markdown: fuente de verdad del evento
lib/            lógica de dominio (registro, github, scoring, dashboard, n8n, privacidad…)
n8n/            workflows importables y su README
scripts/        seed, generadores, verificaciones y ensayo
template-repo/  plantilla del repositorio de cada equipo
tests/          unit, rules y e2e
docs/           decisiones, dataset, arquitectura, despliegue y runbook
```

## Documentación

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): cómo se conectan la app, Firebase, GitHub y n8n.
- [docs/DEPLOY.md](docs/DEPLOY.md): despliegue en Netlify + Firebase y publicación en Pages.
- [docs/RUNBOOK.md](docs/RUNBOOK.md): qué hacer el día del evento si algo falla.
- [docs/DATASET.md](docs/DATASET.md): columnas de la exportación y KPIs en SQL.
- [docs/DECISIONES.md](docs/DECISIONES.md): decisiones técnicas y diferencias con las guías.
- [CLAUDE.md](CLAUDE.md): convenciones del código.

## Datos por confirmar

Montos de premios, auspiciantes, dirección de la sede y jurado no se inventan: viven en
`config/event.ts` como `POR_CONFIRMAR` y la web muestra "Por anunciar" hasta que el comité los
confirme.

## Organiza

Dirección de Innovación y Tecnología · EIGHT LABS, Unidad Educativa Particular Eight Academy, con
n8n como aliado tecnológico.
