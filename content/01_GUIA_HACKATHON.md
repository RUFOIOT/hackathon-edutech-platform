# Hackathon EduTech Eight Academy · by n8n — Guía oficial

**Versión:** v1.0 · borrador para aprobación institucional
**Fechas:** viernes 27 y sábado 28 de noviembre de 2026
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

**Automatización con n8n:** transversal a los tres tracks. Se evalúa en el criterio C4 de la rúbrica.

## 3. Categorías y elegibilidad

| Categoría | Quién participa | Requisito adicional |
|---|---|---|
| Junior | Estudiantes de colegio, 14 a 17 años | Autorización firmada del representante legal y mentor adulto asignado |
| Open | Mayores de 18 años: universitarios, profesionales, docentes | Documento de identidad en el check-in |

- Equipos de 2 a 5 personas. Se aceptan inscripciones individuales: la organización forma equipos el viernes en el bloque de matchmaking.
- Cada equipo es de una sola categoría: Junior u Open.
- Cada equipo compite en un solo track.
- Docentes y personal de Eight Academy pueden participar en Open, pero no ser jurado del track en el que compitan sus estudiantes.
- [CONFIRMAR] Cupo máximo: propuesta de 30 equipos / 150 personas, sujeto al aforo de la sede.

## 4. Agenda

| Día | Hora | Bloque |
|---|---|---|
| Vie 27 | 15:30 | Check-in con QR y entrega de name tags |
| | 16:00 | Inauguración: presentación de tracks, aliados, mentores y jurado |
| | 16:20 | Taller express de n8n (20 min) |
| | 16:40 | Dinámica de integración |
| | 16:50 | Matchmaking de inscritos individuales y confirmación de equipos |
| | **17:00** | **Kick-off oficial: empieza el hacking y se habilita la creación de repositorios** |
| | 17:45 | Rondas de mentoría 1 · validación del problema (los mentores recorren las mesas) |
| | 19:00 | Plazo del checkpoint 1: README con problema, usuario y arquitectura (commit obligatorio) |
| | 21:00 | Cierre de sede. El hacking remoto continúa; los commits fuera de sede son válidos |
| Sáb 28 | 08:00 | Apertura de sede |
| | 09:00 | Desayuno (incluido) |
| | 10:00 | Rondas de mentoría 2 · demo y pitch |
| | 12:30 | Plazo del checkpoint 2: demo funcional mínima desplegada o ejecutable |
| | 13:00 | Almuerzo libre (no incluido) |
| | **14:00** | **Entrega: se cierran el tag `entrega` y el formulario de entrega; validación automática de repositorios** |
| | 15:00 | Show and Tell en dos salas simultáneas |
| | 16:45 | Premiación y cierre (hasta las 17:00) |

> **Reprogramación.** El hackathon se movió al viernes 27 y sábado 28 de noviembre de 2026. En la fecha original (6 y 7 de noviembre) el POA 2026-2027 asignaba el sábado 7 a la "1era Integración Padres" (SEM 009). Debe verificarse que el 27 y 28 estén libres en el POA y confirmarse el uso compartido de la sede el viernes 27, que es día lectivo. Ver sección 12.

## 5. Show and Tell

Una sola ronda, de 15:00 a 16:30, en **dos salas simultáneas con 3 jurados cada una**. Los equipos no se agrupan por track: cada uno indica el track que eligió. No hay final.

Cada equipo dispone de **10 minutos**: 3 de demo en vivo del proyecto funcionando y 7 de preguntas del jurado. El cronómetro es visible en la sala.

Con los puntajes de la rúbrica, normalizados por sala (ver Rúbrica, sección 5), el jurado delibera y define el 1.er y 2.º lugar Open y el mejor equipo Junior. Los resultados se anuncian en la premiación de las 16:45.

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

1. Todo el código del proyecto se escribe dentro de la ventana oficial: viernes 17:00 a sábado 14:00 (hora de Ecuador, UTC-5).
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
| 1.er lugar Open | Categoría Open, todos los tracks | [MONTO USD] |
| 2.º lugar Open | Categoría Open, todos los tracks | [MONTO USD] |
| Mejor equipo Junior | Categoría Junior, todos los tracks | [BENEFICIO] |
| Certificado digital | Todos los participantes | Certificado de participación con la retroalimentación del jurado |

Un equipo recibe como máximo un premio. Los premios económicos de categoría Junior se entregan al representante legal.

## 9. Roles del evento

| Rol | Función | Quién |
|---|---|---|
| Comité organizador | Decisiones, reglas y disputas | Dirección de Innovación y Tecnología [+ CONFIRMAR integrantes] |
| Coordinación operativa | Sede, logística, tiempos, check-in | [CONFIRMAR] |
| Mesa técnica | Plataforma, GitHub, n8n, conectividad | EIGHT LABS |
| Mentores | Acompañan a equipos sin escribir su código | [LISTA] · mínimo 1 por cada 5 equipos |
| Jurado | Evalúa con la rúbrica oficial el sábado (no asiste el viernes) | 6 en total: 3 por sala, al menos uno técnico y uno del sector educativo |
| Marketing | Convocatoria, cobertura y transmisión | Departamento de MKT |
| Inspección y DECE | Seguridad y bienestar de participantes Junior | Inspección / DECE |

## 10. Código de conducta

Respeto, inclusión y cero tolerancia al acoso. Cualquier incidente se reporta a la coordinación operativa o al DECE. Los menores de edad no permanecen en la sede después de las 21:00 y siempre tienen un adulto responsable identificado.

## 11. Propiedad intelectual

El código y la propiedad intelectual pertenecen a cada equipo. Al participar, los equipos otorgan a Eight Academy y a los auspiciantes una licencia no exclusiva para difundir nombre, descripción, capturas y video del proyecto con fines de comunicación del evento. Ningún auspiciante adquiere derechos sobre las soluciones por el solo hecho de premiarlas. [REVISIÓN LEGAL antes de publicar]

## 12. Decisiones pendientes antes de abrir la convocatoria

| N° | Decisión | Por qué bloquea | Responsable |
|---|---|---|---|
| 1 | Verificar en el POA que el sábado 28 esté libre (la fecha original, sábado 7, chocaba con la 1era Integración Padres, SEM 009) | El POA tiene precedencia sobre cualquier fecha | Dirección de sede |
| 2 | Uso de la sede el viernes 27 en jornada lectiva | Define la hora real de inicio | Dirección de sede |
| 3 | Montos de premios y auspiciantes confirmados | No se publica un premio sin respaldo | Comité |
| 4 | Acuerdo de marca con n8n | El nombre del evento lo incluye | Dirección de Innovación |
| 5 | Aforo y conectividad de la sede | Define el cupo máximo | Coordinación operativa |
| 6 | Formato de autorización para menores | Requisito legal para la categoría Junior | DECE / Legal |

## 13. Cronograma de la convocatoria

| Fecha | Hito |
|---|---|
| [lunes 5 oct] | Aprobación del comité y publicación de la web |
| [5 oct – 27 nov] | Inscripciones abiertas |
| [28 oct] | Webinar de preparación: GitHub y n8n |
| [hasta el 27 nov, 12:00] | Confirmación de equipos y envío de autorizaciones Junior |
| viernes 27 nov, 12:00 | Cierre de inscripciones |
| 27–28 nov | Hackathon |
| [4 dic] | Publicación de resultados detallados y certificados |
