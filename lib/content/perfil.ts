import type { RolEquipo } from "@/config/event";

export const NOMBRE_ROL: Record<RolEquipo, string> = {
  producto: "Producto",
  construccion: "Construcción",
  automatizacion: "Automatización",
  datos_ia: "Datos e IA",
  pitch: "Pitch",
};

/** Guía del Hacker §3. */
export const DESCRIPCION_ROL: Record<RolEquipo, string> = {
  producto: "Define el problema y el usuario, prioriza qué entra y qué no",
  construccion: "Arquitectura, código y despliegue",
  automatizacion: "Flujos de n8n e integraciones",
  datos_ia: "Datos sintéticos, modelos y prompts",
  pitch: "Narrativa, demo y control del tiempo en el Show and Tell",
};

export const AREAS = ["desarrollo", "n8n", "ia", "diseno"] as const;
export type Area = (typeof AREAS)[number];

export const NOMBRE_AREA: Record<Area, string> = { desarrollo: "Desarrollo", n8n: "n8n", ia: "IA", diseno: "Diseño" };

/** Escala 1–4 con descripción de cada nivel (prompt §5.1, paso 3). */
export const NIVELES: Record<Area, [string, string, string, string]> = {
  desarrollo: [
    "Nunca he programado o solo seguí tutoriales",
    "Hago programas pequeños con ayuda",
    "Construyo aplicaciones completas por mi cuenta",
    "Diseño arquitecturas y despliego a producción",
  ],
  n8n: [
    "No lo he usado",
    "Armé algún flujo siguiendo una plantilla",
    "Construyo flujos con APIs y lógica propia",
    "Opero flujos en producción con manejo de errores",
  ],
  ia: [
    "Uso chats de IA de forma ocasional",
    "Escribo prompts con intención y reviso resultados",
    "Integro APIs de modelos en aplicaciones",
    "Evalúo modelos, uso RAG o agentes con criterio",
  ],
  diseno: [
    "No he diseñado interfaces",
    "Hago bocetos y wireframes",
    "Diseño interfaces completas en Figma o similar",
    "Investigo con usuarios y diseño sistemas",
  ],
};

export const TECNOLOGIAS = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "React",
  "Next.js",
  "Vue",
  "Flutter",
  "Node.js",
  "SQL",
  "Firebase",
  "Supabase",
  "n8n",
  "APIs de IA",
  "Figma",
  "Docker",
] as const;

export const NIVELES_ACADEMICOS = [
  { valor: "colegio", etiqueta: "Colegio" },
  { valor: "universidad", etiqueta: "Universidad" },
  { valor: "profesional", etiqueta: "Profesional" },
  { valor: "docente", etiqueta: "Docente" },
] as const;

export const TALLAS = ["XS", "S", "M", "L", "XL", "XXL"] as const;
