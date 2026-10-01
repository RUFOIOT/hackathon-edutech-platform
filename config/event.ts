/**
 * Configuración institucional del evento.
 *
 * Fuente de verdad: content/01_GUIA_HACKATHON.md, 02_GUIA_HACKER.md y 03_RUBRICA_EVALUACION.md.
 * Todo dato que la guía marca entre corchetes vive aquí como POR_CONFIRMAR y la interfaz lo
 * muestra como "Por anunciar" (ver `mostrar()`).
 *
 * Todas las fechas llevan el offset explícito -05:00 (America/Guayaquil no tiene horario de verano).
 */

export const POR_CONFIRMAR = "[POR CONFIRMAR]" as const;
export type PorConfirmar = typeof POR_CONFIRMAR;

/** Texto para la interfaz pública cuando un dato institucional aún no está confirmado. */
export function mostrar(valor: string | number | PorConfirmar): string {
  return valor === POR_CONFIRMAR ? "Por anunciar" : String(valor);
}

/**
 * Fecha que el comité aún no confirma. La lógica (fases, cierre de inscripciones) usa la propuesta,
 * pero la interfaz debe advertir que es provisional mientras `confirmada` sea false.
 */
export interface FechaClave {
  iso: string;
  confirmada: boolean;
}

export const TIMEZONE = "America/Guayaquil";

export const EVENT = {
  id: "edutech-2026",
  nombre: "Hackathon EduTech Eight Academy by n8n",
  organiza: "Dirección de Innovación y Tecnología · EIGHT LABS",
  sede: {
    nombre: "Unidad Educativa Particular Eight Academy, sede La Prensa",
    ciudad: "Quito",
    direccion: POR_CONFIRMAR,
    aforo: POR_CONFIRMAR,
  },
  githubOrg: "eight-academy-hackathon",
  repoPlantilla: "edutech-2026-template",
  /** Patrón del nombre de repo: edutech26-t{1|2|3}-{slug}. */
  repoPattern: /^edutech26-t([123])-([a-z0-9]+(?:-[a-z0-9]+)*)$/,
  tagEntrega: "entrega",

  fechas: {
    // Convocatoria (guía §13): todas entre corchetes en la guía.
    publicacionWeb: { iso: "2026-10-05T00:00:00-05:00", confirmada: false },
    aperturaInscripciones: { iso: "2026-10-05T00:00:00-05:00", confirmada: false },
    webinar: { iso: "2026-10-28T18:00:00-05:00", confirmada: false },
    cierreInscripciones: { iso: "2026-10-30T23:59:00-05:00", confirmada: false },
    // Evento (guía §4). Confirmadas en la guía, sujetas a la alerta de calendario del POA (§12, decisión 1).
    checkin: { iso: "2026-11-06T13:30:00-05:00", confirmada: true },
    kickoff: { iso: "2026-11-06T15:30:00-05:00", confirmada: true },
    checkpoint1: { iso: "2026-11-06T19:00:00-05:00", confirmada: true },
    cierreSedeViernes: { iso: "2026-11-06T21:00:00-05:00", confirmada: true },
    checkpoint2: { iso: "2026-11-07T10:30:00-05:00", confirmada: true },
    codeFreeze: { iso: "2026-11-07T12:00:00-05:00", confirmada: true },
    showAndTell: { iso: "2026-11-07T13:30:00-05:00", confirmada: true },
    final: { iso: "2026-11-07T17:00:00-05:00", confirmada: true },
    premiacion: { iso: "2026-11-07T18:30:00-05:00", confirmada: true },
    publicacionResultadosDetallados: { iso: "2026-11-13T12:00:00-05:00", confirmada: false },
  } satisfies Record<string, FechaClave>,

  cupo: {
    // Guía §3: propuesta de 30 equipos / 150 personas, sujeto al aforo.
    maxEquipos: 30,
    maxPersonas: 150,
    confirmado: false,
  },
  equipo: { min: 2, max: 5 },
  categorias: {
    JUNIOR: { edadMin: 14, edadMax: 17, nombre: "Junior" },
    OPEN: { edadMin: 18, edadMax: null, nombre: "Open" },
  },
  showAndTell: { minutosExposicion: 8, minutosPreguntas: 4, minutosTransicion: 3, finalistas: 5 },
  /** Retención de datos personales tras el evento, en meses (Fase 8). */
  retencionMeses: 12,
} as const;

export type FechaKey = keyof typeof EVENT.fechas;

export function fecha(key: FechaKey): Date {
  return new Date(EVENT.fechas[key].iso);
}

export type TrackCode = "T1" | "T2" | "T3";
export const TRACK_CODES: readonly TrackCode[] = ["T1", "T2", "T3"];

export const TRACKS: Record<TrackCode, { nombre: string; pregunta: string; ejemplos: string[] }> = {
  T1: {
    nombre: "Problemáticas de la educación",
    pregunta: "¿Qué impide que un estudiante aprenda, permanezca o se sienta bien en el colegio?",
    ejemplos: ["Alerta temprana de deserción", "Tutor adaptativo", "Inclusión NEE", "Bienestar socioemocional", "Brecha de acceso"],
  },
  T2: {
    nombre: "Infraestructura y mejora de sistemas educativos estudiantiles",
    pregunta: "¿Qué sistema usa el estudiante a diario y cómo lo hacemos más útil, abierto y confiable?",
    ejemplos: [
      "Portafolio digital con credenciales verificables",
      "Integración de plataformas (LMS, Runachay)",
      "Analítica de aprendizaje",
      "Accesibilidad",
      "Conectividad offline",
    ],
  },
  T3: {
    nombre: "Soluciones comerciales y administrativas para instituciones",
    pregunta: "¿Qué proceso de la institución consume tiempo, dinero o confianza y puede automatizarse?",
    ejemplos: [
      "Admisiones y matrículas",
      "Cobranza y pensiones",
      "Horarios y distributivo",
      "Comunicación con familias",
      "Planificación curricular (PCA/PSA)",
      "Reportes de cumplimiento",
    ],
  },
};

export const PREMIO_TRANSVERSAL = "Premio n8n a la mejor automatización";

/** Guía §8. Montos y beneficios pendientes: nunca se inventan. */
export const PREMIOS: { premio: string; alcance: string; beneficio: string }[] = [
  { premio: "1er lugar general", alcance: "Todos los tracks", beneficio: POR_CONFIRMAR },
  { premio: "2do lugar general", alcance: "Todos los tracks", beneficio: POR_CONFIRMAR },
  { premio: "3er lugar general", alcance: "Todos los tracks", beneficio: POR_CONFIRMAR },
  { premio: "Mejor solución por track", alcance: "T1, T2, T3", beneficio: POR_CONFIRMAR },
  { premio: PREMIO_TRANSVERSAL, alcance: "Transversal", beneficio: POR_CONFIRMAR },
  { premio: "Mejor equipo Junior", alcance: "Categoría Junior", beneficio: POR_CONFIRMAR },
  {
    premio: "Pase a la Aceleradora Eight Academy",
    alcance: "Hasta 3 equipos",
    beneficio: "Cupo en la siguiente cohorte del bootcamp",
  },
];

/** Auspiciantes y aliados: vacío hasta que el comité confirme (guía §12, decisiones 3 y 4). */
export const ALIADOS: { nombre: string; url: string }[] = [];

/** Agenda oficial (guía §4). `hito` marca los bloques que la guía destaca en negrita. */
export const AGENDA: { dia: "Viernes 6" | "Sábado 7"; hora: string; bloque: string; hito?: boolean }[] = [
  { dia: "Viernes 6", hora: "13:30", bloque: "Check-in con QR, entrega de credenciales y kit" },
  { dia: "Viernes 6", hora: "14:30", bloque: "Inauguración, presentación de tracks, aliados y jurado" },
  { dia: "Viernes 6", hora: "15:15", bloque: "Matchmaking de inscritos individuales y confirmación de equipos" },
  { dia: "Viernes 6", hora: "15:30", bloque: "Kick-off oficial: se habilita la creación de repositorios", hito: true },
  { dia: "Viernes 6", hora: "16:00", bloque: "Taller express de n8n (30 min)" },
  { dia: "Viernes 6", hora: "17:00", bloque: "Ronda de mentoría 1 · validación del problema" },
  { dia: "Viernes 6", hora: "19:00", bloque: "Checkpoint 1: README con problema, usuario y arquitectura (commit obligatorio)" },
  { dia: "Viernes 6", hora: "21:00", bloque: "Cierre de sede. El hacking remoto continúa; los commits fuera de sede son válidos" },
  { dia: "Sábado 7", hora: "08:00", bloque: "Apertura de sede, desayuno" },
  { dia: "Sábado 7", hora: "09:00", bloque: "Ronda de mentoría 2 · demo y pitch" },
  { dia: "Sábado 7", hora: "10:30", bloque: "Checkpoint 2: demo funcional mínima desplegada o ejecutable" },
  { dia: "Sábado 7", hora: "12:00", bloque: "Code freeze: tag entrega y formulario de entrega cerrados", hito: true },
  { dia: "Sábado 7", hora: "12:00", bloque: "Validación automática de repositorios" },
  { dia: "Sábado 7", hora: "13:30", bloque: "Show and Tell · ronda semifinal por track (salas paralelas)" },
  { dia: "Sábado 7", hora: "17:00", bloque: "Final: top 5 en plenaria" },
  { dia: "Sábado 7", hora: "18:30", bloque: "Deliberación, premiación y cierre" },
];

/** Preguntas frecuentes: Guía del Hacker §10 y reglas de la guía §3 y §7. */
export const FAQ: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: "¿Quién puede participar?",
    respuesta:
      "Estudiantes de colegio de 14 a 17 años (categoría Junior, con autorización firmada del representante legal y un mentor adulto asignado) y mayores de 18: universitarios, profesionales y docentes (categoría Open).",
  },
  {
    pregunta: "¿Necesito tener equipo para inscribirme?",
    respuesta:
      "No. Los equipos son de 2 a 5 personas, pero puedes inscribirte solo: la organización forma equipos el viernes en el bloque de matchmaking.",
  },
  { pregunta: "¿Puedo cambiar de track durante el evento?", respuesta: "Sí, hasta el checkpoint 1 del viernes a las 19:00." },
  {
    pregunta: "¿Puedo usar un proyecto que ya tenía?",
    respuesta:
      "No como proyecto. Puedes llegar con ideas, bocetos e investigación, y reutilizar librerías o componentes genéricos declarándolos en PRIOR_WORK.md.",
  },
  {
    pregunta: "¿Debo quedarme toda la noche en la sede?",
    respuesta: "No. La sede cierra a las 21:00 del viernes. Pueden seguir trabajando de forma remota y los commits cuentan.",
  },
  { pregunta: "¿La IA está permitida?", respuesta: "Sí, y debe declararse en AI_USAGE.md. El jurado valora el criterio con el que la usaron." },
  {
    pregunta: "¿Puedo usar datos reales de estudiantes?",
    respuesta:
      "No. Se trabaja solo con datos sintéticos o anonimizados, conforme a la LOPDP. La mesa técnica entrega un dataset ficticio de un colegio.",
  },
  {
    pregunta: "¿Qué pasa si mi demo falla en vivo?",
    respuesta:
      "El jurado evalúa con lo que ve y con el repositorio. Un video de respaldo solo se usa si la mesa técnica confirma una falla de conectividad de la sede.",
  },
];

/** Guía del Hacker §9. */
export const MENTORIA_TEMAS = ["producto", "tecnica", "n8n", "ia", "pitch"] as const;
export type MentoriaTema = (typeof MENTORIA_TEMAS)[number];

/** Guía del Hacker §3. */
export const ROLES_EQUIPO = ["producto", "construccion", "automatizacion", "datos_ia", "pitch"] as const;
export type RolEquipo = (typeof ROLES_EQUIPO)[number];
