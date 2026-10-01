# Hackathon EduTech Eight Academy · by n8n — Guía oficial

**Versión:** v1.0 · borrador para aprobación institucional
**Fechas:** viernes 6 y sábado 7 de noviembre de 2026
**Sede:** Unidad Educativa Particular Eight Academy, sede La Prensa (Quito) · [CONFIRMAR dirección exacta y aforo]
**Organiza:** Dirección de Innovación y Tecnología · EIGHT LABS
**Aliado tecnológico:** n8n · [CONFIRMAR acuerdo de uso de marca]
**Responsable:** Felipe Salgado

> Los campos entre corchetes `[ ]` son decisiones institucionales pendientes. No se publican hasta estar confirmados.

---

## 1. Propósito

Convocar a estudiantes, universitarios y profesionales a construir, en 48 horas, soluciones tecnológicas funcionales para los problemas reales de la educación: cómo aprende un estudiante, cómo funciona una institución y cómo se sostiene económicamente.

La regla de oro del evento: **se premia lo que funciona en vivo y está en el repositorio, no lo que se promete en una diapositiva.**

## 2. Tracks

| Track | Nombre | Pregunta guía | Ejemplos de retos |
|---|---|---|---|
| T1 | Problemáticas de la educación | ¿Qué impide que un estudiante aprenda, permanezca o se sienta bien en el colegio? | Alerta temprana de deserción, tutor adaptativo, inclusión NEE, bienestar socioemocional, brecha de acceso |
| T2 | Infraestructura y mejora de sistemas educativos estudiantiles | ¿Qué sistema usa el estudiante a diario y cómo lo hacemos más útil, abierto y confiable? | Portafolio digital con credenciales verificables, integración de plataformas (LMS, Runachay), analítica de aprendizaje, accesibilidad, conectividad offline |
| T3 | Soluciones comerciales y administrativas para instituciones | ¿Qué proceso de la institución consume tiempo, dinero o confianza y puede automatizarse? | Admisiones y matrículas, cobranza y pensiones, horarios y distributivo, comunicación con familias, planificación curricular (PCA/PSA), reportes de cumplimiento |

**Premio transversal n8n:** mejor automatización construida con n8n en cualquier track.

## 3. Categorías y elegibilidad

| Categoría | Quién participa | Requisito adicional |
|---|---|---|
| Junior | Estudiantes de colegio, 14 a 17 años | Autorización firmada del representante legal y mentor adulto asignado |
| Open | Mayores de 18 años: universitarios, profesionales, docentes | Documento de identidad en el check-in |

- Equipos de 2 a 5 personas. Se aceptan inscripciones individuales: la organización forma equipos el viernes en el bloque de matchmaking.
- Cada equipo compite en un solo track.
- Docentes y personal de Eight Academy pueden participar en Open, pero no ser jurado del track en el que compitan sus estudiantes.
- [CONFIRMAR] Cupo máximo: propuesta de 30 equipos / 150 personas, sujeto al aforo de la sede.

## 4. Agenda

| Día | Hora | Bloque |
|---|---|---|
| Vie 6 | 13:30 | Check-in con QR, entrega de credenciales y kit |
| | 14:30 | Inauguración, presentación de tracks, aliados y jurado |
| | 15:15 | Matchmaking de inscritos individuales y confirmación de equipos |
| | **15:30** | **Kick-off oficial: se habilita la creación de repositorios** |
| | 16:00 | Taller express de n8n (30 min) |
| | 17:00 | Ronda de mentoría 1 · validación del problema |
| | 19:00 | Checkpoint 1: README con problema, usuario y arquitectura (commit obligatorio) |
| | 21:00 | Cierre de sede. El hacking remoto continúa; los commits fuera de sede son válidos |
| Sáb 7 | 08:00 | Apertura de sede, desayuno |
| | 09:00 | Ronda de mentoría 2 · demo y pitch |
| | 10:30 | Checkpoint 2: demo funcional mínima desplegada o ejecutable |
| | **12:00** | **Code freeze: tag `entrega` y formulario de entrega cerrados** |
| | 12:00 | Validación automática de repositorios |
| | 13:30 | Show and Tell · ronda semifinal por track (salas paralelas) |
| | 17:00 | Final: top 5 en plenaria |
| | 18:30 | Deliberación, premiación y cierre |

> **Alerta de calendario institucional.** El POA 2026-2027 asigna el sábado 7 de noviembre a la "1era Integración Padres" (SEM 009, responsables: Comité de padres, Directora de sección, docentes tutores) y el viernes 6 es día lectivo. Antes de publicar la convocatoria debe resolverse el uso compartido de la sede o reprogramar. Ver sección 12.

## 5. Capacidad del Show and Tell

Cada equipo dispone de **12 minutos como máximo**: 8 de exposición y demo en vivo, 4 de preguntas del jurado. Con 3 minutos de transición, cada sala evalúa 4 equipos por hora.

| Equipos inscritos | Salas de semifinal | Duración de semifinal |
|---|---|---|
| hasta 12 | 1 | 3 h |
| 13 a 24 | 2 (una por track; T1+T2 comparten si hace falta) | 3 h |
| 25 a 30 | 3 (una por track) | 2 h 30 |

La final reúne a los 5 mejores puntajes normalizados (ver Rúbrica, sección 5).

## 6. Infraestructura técnica

Todo el evento se gestiona sobre GitHub.

- **Organización GitHub:** `eight-academy-hackathon` [CONFIRMAR nombre disponible].
- **Repositorio plantilla:** `edutech-2026-template`, con la estructura obligatoria (ver Guía del Hacker).
- **Nombre del repositorio de cada equipo:** `edutech26-t{track}-{slug-del-equipo}` · ejemplo `edutech26-t3-matricula-express`.
- **Visibilidad:** público desde el code freeze. Puede ser privado durante el evento si el jurado técnico tiene acceso de lectura.
- **Plataforma del evento:** web pública + registro + dashboard 360, construida según `04_PROMPT_CLAUDE_CODE.md`.
- **Automatizaciones:** n8n gestiona confirmaciones, monitoreo de repositorios, validación de entregas, consolidación de puntajes y certificados.
- **Conectividad:** [CONFIRMAR] red dedicada para participantes con capacidad para 150 dispositivos, y red separada para jurado y transmisión.

## 7. Reglas de juego

1. Todo el código del proyecto se escribe dentro de la ventana oficial: viernes 15:30 a sábado 12:00 (hora de Ecuador, UTC-5).
2. Se permite usar librerías open source, APIs, plantillas de n8n y boilerplates públicos, siempre que se declaren en `PRIOR_WORK.md`.
3. Se permite usar inteligencia artificial para construir. Su uso se declara en `AI_USAGE.md`. Ocultarlo es causal de descalificación; usarlo no resta puntos.
4. Prohibido usar datos reales de estudiantes, familias o docentes. Se trabaja con datos sintéticos o anonimizados. Esto aplica la LOPDP.
5. El repositorio entregado es el que se evalúa. Lo que no está en el tag `entrega` no existe para el jurado.
6. La demo debe correr en vivo. Un video solo se acepta como respaldo si falla la conectividad de la sede, y el jurado lo registra.

### Causales de descalificación

- Commits del proyecto con fecha anterior al kick-off sin declarar en `PRIOR_WORK.md`.
- Plagio de un proyecto existente presentado como propio.
- Uso de datos personales reales.
- Incumplimiento del código de conducta.
- Entregar después del code freeze sin autorización del comité.

## 8. Premios

| Premio | Alcance | Monto o beneficio |
|---|---|---|
| 1er lugar general | Todos los tracks | [MONTO USD] |
| 2do lugar general | Todos los tracks | [MONTO USD] |
| 3er lugar general | Todos los tracks | [MONTO USD] |
| Mejor solución por track | T1, T2, T3 | [BENEFICIO DE AUSPICIANTE] |
| Premio n8n a la mejor automatización | Transversal | [CONFIRMAR con n8n] |
| Mejor equipo Junior | Categoría Junior | [BENEFICIO] |
| Pase a la Aceleradora Eight Academy | Hasta 3 equipos | Cupo en la siguiente cohorte del bootcamp |

Un equipo puede recibir como máximo un premio general y un premio especial. Los premios económicos de categoría Junior se entregan al representante legal.

## 9. Roles del evento

| Rol | Función | Quién |
|---|---|---|
| Comité organizador | Decisiones, reglas y disputas | Dirección de Innovación y Tecnología [+ CONFIRMAR integrantes] |
| Coordinación operativa | Sede, logística, tiempos, check-in | [CONFIRMAR] |
| Mesa técnica | Plataforma, GitHub, n8n, conectividad | EIGHT LABS |
| Mentores | Acompañan a equipos sin escribir su código | [LISTA] · mínimo 1 por cada 5 equipos |
| Jurado | Evalúa con la rúbrica oficial | 3 a 5 por sala, al menos uno técnico y uno del sector educativo |
| Marketing | Convocatoria, cobertura y transmisión | Departamento de MKT |
| Inspección y DECE | Seguridad y bienestar de participantes Junior | Inspección / DECE |

## 10. Código de conducta

Respeto, inclusión y cero tolerancia al acoso. Cualquier incidente se reporta a la coordinación operativa o al DECE. Los menores de edad no permanecen en la sede después de las 21:00 y siempre tienen un adulto responsable identificado.

## 11. Propiedad intelectual

El código y la propiedad intelectual pertenecen a cada equipo. Al participar, los equipos otorgan a Eight Academy y a los auspiciantes una licencia no exclusiva para difundir nombre, descripción, capturas y video del proyecto con fines de comunicación del evento. Ningún auspiciante adquiere derechos sobre las soluciones por el solo hecho de premiarlas. [REVISIÓN LEGAL antes de publicar]

## 12. Decisiones pendientes antes de abrir la convocatoria

| N° | Decisión | Por qué bloquea | Responsable |
|---|---|---|---|
| 1 | Resolver el cruce con la 1era Integración Padres del sábado 7 (POA, SEM 009) | El POA tiene precedencia sobre cualquier fecha | Dirección de sede |
| 2 | Uso de la sede el viernes 6 en jornada lectiva | Define la hora real de inicio | Dirección de sede |
| 3 | Montos de premios y auspiciantes confirmados | No se publica un premio sin respaldo | Comité |
| 4 | Acuerdo de marca con n8n | El nombre del evento lo incluye | Dirección de Innovación |
| 5 | Aforo y conectividad de la sede | Define el cupo máximo | Coordinación operativa |
| 6 | Formato de autorización para menores | Requisito legal para la categoría Junior | DECE / Legal |

## 13. Cronograma de la convocatoria

| Fecha | Hito |
|---|---|
| [lunes 5 oct] | Aprobación del comité y publicación de la web |
| [5 oct – 30 oct] | Inscripciones abiertas |
| [28 oct] | Webinar de preparación: GitHub y n8n |
| [30 oct, 23:59] | Cierre de inscripciones |
| [4 – 5 nov] | Confirmación de equipos y envío de autorizaciones Junior (2 y 3 de noviembre son feriado) |
| 6 – 7 nov | Hackathon |
| [13 nov] | Publicación de resultados detallados y certificados |
