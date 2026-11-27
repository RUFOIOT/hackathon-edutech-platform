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
  /** Responsable del tratamiento de datos (LOPDP): razón social y correo para ejercer derechos. */
  responsableDatos: { nombre: "Unidad Educativa Particular Eight Academy", correo: POR_CONFIRMAR, direccion: POR_CONFIRMAR },
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
  /** Página del evento en Luma (comunidad n8n): se promociona en la portada durante la convocatoria. */
  luma: "https://luma.com/n8n-6i9c",

  fechas: {
    // Convocatoria (guía §13): todas entre corchetes en la guía.
    publicacionWeb: { iso: "2026-10-05T00:00:00-05:00", confirmada: false },
    aperturaInscripciones: { iso: "2026-10-05T00:00:00-05:00", confirmada: false },
    webinar: { iso: "2026-10-28T18:00:00-05:00", confirmada: false },
    // 27 nov 2026 09:10: la organización cerró inscripciones antes de lo previsto (12:00).
    cierreInscripciones: { iso: "2026-11-27T09:10:00-05:00", confirmada: true },
    // Evento (guía §4). Agenda acordada en la reunión de staff del 10 nov 2026.
    checkin: { iso: "2026-11-27T15:00:00-05:00", confirmada: true },
    kickoff: { iso: "2026-11-27T17:00:00-05:00", confirmada: true },
    checkpoint1: { iso: "2026-11-27T19:00:00-05:00", confirmada: true },
    cierreSedeViernes: { iso: "2026-11-27T21:00:00-05:00", confirmada: true },
    checkpoint2: { iso: "2026-11-28T12:30:00-05:00", confirmada: true },
    codeFreeze: { iso: "2026-11-28T14:00:00-05:00", confirmada: true },
    showAndTell: { iso: "2026-11-28T15:00:00-05:00", confirmada: true },
    /** Hora límite interna para que el jurado tenga los resultados (no se publica en la agenda). */
    resultadosListos: { iso: "2026-11-28T16:15:00-05:00", confirmada: true },
    premiacion: { iso: "2026-11-28T16:45:00-05:00", confirmada: true },
    cierreEvento: { iso: "2026-11-28T17:00:00-05:00", confirmada: true },
    publicacionResultadosDetallados: { iso: "2026-12-04T12:00:00-05:00", confirmada: false },
  } satisfies Record<string, FechaClave>,

  cupo: {
    // Guía §3 proponía 30 equipos / 150 personas; el 25 nov 2026 la organización subió el tope a 35 equipos.
    maxEquipos: 35,
    maxPersonas: 150,
    confirmado: false,
  },
  equipo: { min: 2, max: 5 },
  categorias: {
    JUNIOR: { edadMin: 14, edadMax: 17, nombre: "Junior" },
    OPEN: { edadMin: 18, edadMax: null, nombre: "Open" },
  },
  /**
   * Show and Tell (D-49, 27 nov 2026): ronda de salas en 3 salas simultáneas con 3 jurados cada una,
   * sin agrupar por track. 6 min por equipo (3 de demo en vivo y 2 de preguntas) más 1 de transición.
   * Cada sala saca un finalista (su mayor puntaje) y los 3 presentan en la final ante los 9 jurados.
   */
  showAndTell: { minutosExposicion: 3, minutosPreguntas: 2, minutosTransicion: 1, salas: 3, juecesPorSala: 3 },
  /** Final del Show and Tell: 3 finalistas, 3 min de demo y 3 de preguntas cada uno, ante los 9 jurados. */
  finalShowAndTell: { finalistas: 3, minutosExposicion: 3, minutosPreguntas: 3 },
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

/** Nombres de los premios: los usan la web, el cálculo (lib/scoring.ts) y los certificados. */
export const PREMIO = {
  primeroOpen: "1.er lugar Open",
  segundoOpen: "2.º lugar Open",
  mejorJunior: "Mejor equipo Junior",
} as const;

/** Guía §8: premios confirmados por el comité (hoja MASTER del staff, pestaña «Premios», 17 nov 2026). */
export const PREMIOS: { premio: string; alcance: string; beneficios: string[] }[] = [
  { premio: PREMIO.primeroOpen, alcance: "Categoría Open, todos los tracks", beneficios: ["Beca del 50 % para la delegación de Silicon Valley Delegations (25 al 30 de abril de 2027, con hospedaje), valorada en USD 3,750 y sorteada entre los integrantes del equipo. Quien más del equipo quiera viajar recibe un 20 % de descuento (USD 1,500 cada uno). No incluye vuelos ni visa; aplican términos y condiciones.", "USD 300 para repartir entre los integrantes del equipo", "Pase a la aceleradora Eight Academy: cupo en la siguiente cohorte del bootcamp"] },
  { premio: PREMIO.segundoOpen, alcance: "Categoría Open, todos los tracks", beneficios: ["USD 200 para repartir entre los integrantes del equipo", "Pase a la aceleradora Eight Academy: cupo en la siguiente cohorte del bootcamp"] },
  { premio: PREMIO.mejorJunior, alcance: "Categoría Junior, todos los tracks", beneficios: ["Beca de inglés", "Pase a la aceleradora Eight Academy: cupo en la siguiente cohorte del bootcamp"] },
  { premio: "Certificado digital", alcance: "Todos los participantes", beneficios: ["Certificado de participación con la retroalimentación del jurado"] },
];

/**
 * Mentores y jurado confirmados (hoja MASTER del staff, pestaña «Mentores y jurados», 23 nov 2026).
 * Solo quien tiene «SI» en Confirmación. Bios resumidas de lo que cada persona envió; sin teléfonos
 * ni correos. Al confirmar a alguien más, agrégalo aquí.
 */
export interface PersonaInvitada {
  nombre: string;
  organizacion: string;
  bio: string;
  linkedin: string;
  /** Foto enviada por la persona para el evento (public/media/personas/, 320×320). Sin foto: iniciales. */
  foto?: string;
  /**
   * Tarjeta de perfil animada del evento (public/media/personas/perfil/<slug>.mp4, 600×800, 10 s,
   * sin audio) con su póster <slug>.jpg. Si existe, reemplaza a la foto en la portada.
   */
  perfil?: string;
}

export const MENTORES: PersonaInvitada[] = [
  {
    nombre: "Iván Terceros",
    organizacion: "Openlab",
    bio: "Sociólogo y especialista en innovación abierta. Cofundador y coordinador de la Fundación Openlab Ecuador, con más de diez años diseñando y facilitando laboratorios de innovación, hackatones y procesos de prototipado colaborativo.",
    linkedin: "https://www.linkedin.com/in/ivntres/",
    perfil: "/media/personas/perfil/ivan-terceros",
  },
  {
    nombre: "Miguel Vargas",
    organizacion: "Lernix",
    bio: "Ingeniero de software con más de 10 años creando productos. Es VP of Engineering en Lernix, donde desarrolla IA para la educación, y antes construyó aplicaciones para salud, fintech e IA.",
    linkedin: "https://www.linkedin.com/in/lmiguelvargasf/",
    foto: "/media/personas/miguel-vargas.jpg",
    perfil: "/media/personas/perfil/miguel-vargas",
  },
  {
    nombre: "Luis Fernando Cuji",
    organizacion: "PoliDevs",
    bio: "Ingeniero de software y fundador de PoliDevs, startup ecuatoriana de desarrollo tecnológico. Tiene experiencia en arquitectura y despliegue de soluciones B2B, facturación electrónica, aplicaciones móviles e IA generativa.",
    linkedin: "https://www.linkedin.com/in/luis-fernando-cuji-7178b5378/",
    perfil: "/media/personas/perfil/luis-fernando-cuji",
  },
  {
    nombre: "Damián Palacios",
    organizacion: "Insight Transfer Ecuador",
    bio: "Fundador y director de Insight Transfer Ecuador, docente en la Universidad Central y la UISEK, y entrenador de mentores en emprendimiento acreditado por KOICA y ConQuito.",
    linkedin: "https://www.linkedin.com/in/dpalaciosz-tit",
    foto: "/media/personas/damian-palacios.jpg",
    perfil: "/media/personas/perfil/damian-palacios",
  },
  {
    nombre: "Martín Ruiz",
    organizacion: "Citus",
    bio: "Ingeniero de producto y desarrollador de software con más de 14 años conectando necesidades de usuario con soluciones técnicas. Trabaja con arquitecturas modernas, desarrollo guiado por IA y plataformas modulares.",
    linkedin: "https://www.linkedin.com/in/martin-ruizn/",
    perfil: "/media/personas/perfil/martin-ruiz",
  },
  {
    nombre: "Sebastián Márquez",
    organizacion: "Kernel Growth",
    bio: "Fundador de Kernel Growth. Arquitecto de automatización, IA y sistemas de crecimiento B2B.",
    linkedin: "https://www.linkedin.com/in/smarquezbusiness/",
    perfil: "/media/personas/perfil/sebastian-marquez",
  },
  {
    nombre: "Xavier Flores",
    organizacion: "Tether Group",
    bio: "Ejecutivo de producto y emprendedor con más de 15 años en tecnología e innovación digital. Ha liderado iniciativas en Waze, Telefónica, Sovos y Tether Group, y fundó GomiGuide, plataforma de turismo regenerativo.",
    linkedin: "https://www.linkedin.com/in/xflores/",
    perfil: "/media/personas/perfil/xavier-flores",
  },
];

export const JURADO: PersonaInvitada[] = [
  {
    nombre: "Rommel De los Ríos",
    organizacion: "grou.online",
    bio: "Managing Partner de grou.online, agencia de estrategia digital, software e IA. Trabaja en producto y Web3: construye productos digitales con IA y ha ayudado a startups y comunidades Web3 a escalar.",
    linkedin: "https://www.linkedin.com/in/romdelosrios/",
    foto: "/media/personas/rommel-de-los-rios.jpg",
    perfil: "/media/personas/perfil/rommel-de-los-rios",
  },
  {
    nombre: "Christian Rivera",
    organizacion: "Kudert",
    bio: "Cofundador y CEO de Kudert, la herramienta con la que más de 1.000 empresas en más de 10 países miden habilidades blandas. Fundó también Skilt, un simulador de habilidades digitales.",
    linkedin: "https://www.linkedin.com/in/christorivera/",
    perfil: "/media/personas/perfil/christian-rivera",
  },
  {
    nombre: "César Salazar",
    organizacion: "Lernix",
    bio: "Fundador y CEO de Lernix, empresa de IA para la educación que acompaña a colegios y universidades a adoptar IA. Ingeniero de la EPN, con educación ejecutiva en MIT y Stanford.",
    linkedin: "https://www.linkedin.com/in/salazarcesar/",
    foto: "/media/personas/cesar-salazar.jpg",
    perfil: "/media/personas/perfil/cesar-salazar",
  },
  {
    nombre: "Mateo Moreira",
    organizacion: "MOA",
    bio: "Fundador de MOA, consultora de tecnología y educación corporativa, y gerente de producto de Microsoft AI Business Solutions en TD SYNNEX Ecuador. Profesor universitario y divulgador de IA.",
    linkedin: "https://www.linkedin.com/in/mateo-moreira-arias-589154203/",
    perfil: "/media/personas/perfil/mateo-moreira",
  },
  {
    nombre: "Leonardo Burbano",
    organizacion: "Mercately",
    bio: "Senior AI Engineer y Tech Lead en Mercately (Techstars), donde lidera el equipo que desarrolla agentes conversacionales con LLMs para más de 1.500 negocios en 20 países. Ingeniero en Electrónica de la EPN.",
    linkedin: "https://www.linkedin.com/in/leoburbano/",
    perfil: "/media/personas/perfil/leonardo-burbano",
  },
  {
    nombre: "María Isabel Vaca",
    organizacion: "VAMI",
    bio: "CEO de VAMI Business & Analytics Developers. Trabaja en estrategia, marketing y desarrollo de productos; es mentora en el Tec de Monterrey, profesora de maestría en la UDLA y ha sido jurado de los Effie Awards Latam.",
    linkedin: "https://www.linkedin.com/in/mar%C3%ADa-isabel-vaca-almeida-13648327/",
    perfil: "/media/personas/perfil/maria-isabel-vaca",
  },
  {
    nombre: "Daniel Jerez",
    organizacion: "UTA",
    bio: "Emprendedor tecnológico, docente en la UTA y la UEES y coordinador de la Oficina de Transferencia Tecnológica FISEI-UTA. Trabaja en software, educación STEAM, automatización e IA aplicada a los negocios.",
    linkedin: "https://www.linkedin.com/in/daniel-sebastian-j-3aa6a1154/",
    perfil: "/media/personas/perfil/daniel-jerez",
  },
  {
    nombre: "Gabriela Cobo",
    organizacion: "Kaito Networks",
    bio: "Líder de producto e innovación con más de 10 años en Europa, Estados Unidos y Latinoamérica. Lidera Producto en Kaito Networks, fintech de pagos transfronterizos, y ha trabajado en Farfetch, Inditex, Thoughtworks y DeUna.",
    linkedin: "https://www.linkedin.com/in/gcobo/",
    perfil: "/media/personas/perfil/gabriela-cobo",
  },
];

/** Auspiciantes y aliados: vacío hasta que el comité confirme (guía §12, decisiones 3 y 4). */
export const ALIADOS: { nombre: string; url: string }[] = [
  // Carta de participación del 19 nov 2026 (becas del curso de Python para el equipo ganador).
  { nombre: "Algorithmics Cumbayá - Tumbaco", url: "https://www.instagram.com/algorithmicscumbaec/" },
];

/** Agenda oficial (guía §4). `hito` marca los bloques que la guía destaca en negrita. */
export const AGENDA: { dia: "Viernes 27" | "Sábado 28"; hora: string; bloque: string; hito?: boolean }[] = [
  { dia: "Viernes 27", hora: "15:00", bloque: "Check-in con QR y entrega de name tags" },
  { dia: "Viernes 27", hora: "16:00", bloque: "Inauguración: presentación de tracks, aliados, mentores y jurado" },
  { dia: "Viernes 27", hora: "16:20", bloque: "Taller express de n8n (20 min)" },
  { dia: "Viernes 27", hora: "16:40", bloque: "Dinámica de integración" },
  { dia: "Viernes 27", hora: "16:50", bloque: "Matchmaking de inscritos individuales y confirmación de equipos" },
  { dia: "Viernes 27", hora: "17:00", bloque: "Kick-off oficial: empieza el hacking y se habilita la creación de repositorios", hito: true },
  { dia: "Viernes 27", hora: "17:45", bloque: "Rondas de mentoría 1 · validación del problema (los mentores recorren las mesas)" },
  { dia: "Viernes 27", hora: "19:00", bloque: "Plazo del checkpoint 1: README con problema, usuario y arquitectura (commit obligatorio)" },
  { dia: "Viernes 27", hora: "21:00", bloque: "Cierre de sede. El hacking remoto continúa; los commits fuera de sede son válidos" },
  { dia: "Sábado 28", hora: "08:00", bloque: "Apertura de sede" },
  { dia: "Sábado 28", hora: "09:00", bloque: "Desayuno" },
  { dia: "Sábado 28", hora: "10:00", bloque: "Rondas de mentoría 2 · demo y pitch" },
  { dia: "Sábado 28", hora: "12:30", bloque: "Plazo del checkpoint 2: demo funcional mínima desplegada o ejecutable" },
  { dia: "Sábado 28", hora: "13:00", bloque: "Almuerzo libre (no incluido)" },
  { dia: "Sábado 28", hora: "14:00", bloque: "Entrega: se cierran el tag entrega y el formulario de entrega; validación automática de repositorios", hito: true },
  { dia: "Sábado 28", hora: "15:00", bloque: "Show and Tell: ronda de salas en 3 salas simultáneas (6 min por equipo)" },
  { dia: "Sábado 28", hora: "16:20", bloque: "Final: los 3 finalistas, uno por sala, ante los 9 jurados", hito: true },
  { dia: "Sábado 28", hora: "16:45", bloque: "Premiación y cierre (hasta las 17:00)" },
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
    pregunta: "¿Hay comida durante el evento?",
    respuesta: "El sábado de 9:00 a 10:00 hay desayuno incluido. El almuerzo del sábado (13:00 a 14:00) es libre y no está incluido: cada participante elige dónde comer.",
  },
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
