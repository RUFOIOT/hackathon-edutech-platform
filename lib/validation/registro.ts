import { z } from "zod";
import { ROLES_EQUIPO } from "@/config/event";
import { TALLAS } from "@/lib/content/perfil";
import { calcularCategoria } from "@/lib/models/categoria";

/**
 * Esquemas del registro por pasos (prompt §5.1). Se usan en el cliente (mensajes inmediatos) y
 * en el servidor (fuente de verdad). Los mensajes dicen qué pasó y cómo corregirlo.
 */

const texto = (min: number, max: number, campo: string) =>
  z
    .string({ error: `Escribe ${campo}.` })
    .trim()
    .min(min, `Escribe ${campo} (mínimo ${min} caracteres).`)
    .max(max, `Usa como máximo ${max} caracteres para ${campo}.`);

export const CODIGO_INVITACION = /^[A-HJ-NP-Z2-9]{6}$/;

export const paso1Schema = z
  .object({
    modo: z.enum(["equipo", "individual", "unirse"], { error: "Elige cómo quieres inscribirte." }),
    codigo: z.string().trim().toUpperCase().optional(),
  })
  .refine((d) => d.modo !== "unirse" || CODIGO_INVITACION.test(d.codigo ?? ""), {
    path: ["codigo"],
    message: "El código de invitación tiene 6 caracteres (letras y números), por ejemplo K7PM3Q.",
  });

/** Celular de Ecuador (09XXXXXXXX) o internacional con prefijo (+ y 8 a 15 dígitos). */
export const CELULAR = /^(09\d{8}|\+\d{8,15})$/;
/** Reglas de nombres de usuario de GitHub. */
export const GITHUB_USUARIO = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

const celular = (mensaje: string) =>
  z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(CELULAR, mensaje));

export const paso2Schema = z.object({
  nombres: texto(2, 60, "tus nombres"),
  apellidos: texto(2, 60, "tus apellidos"),
  celular: celular("Escribe tu celular con 10 dígitos (09XXXXXXXX) o con prefijo internacional (+…)."),
  fechaNacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Escribe tu fecha de nacimiento.")
    .superRefine((f, ctx) => {
      const r = calcularCategoria(f);
      if (!r.ok) ctx.addIssue({ code: "custom", message: r.motivo });
      else if (r.edad > 100) ctx.addIssue({ code: "custom", message: "Revisa el año de tu fecha de nacimiento." });
    }),
  ciudad: texto(2, 60, "tu ciudad"),
  institucion: texto(2, 100, "tu institución u organización"),
  nivel: z.enum(["colegio", "universidad", "profesional", "docente"], { error: "Elige tu nivel." }),
  githubUsername: z
    .string()
    .trim()
    .regex(GITHUB_USUARIO, "Escribe tu usuario de GitHub tal como aparece en github.com/usuario (sin @)."),
  talla: z.enum(TALLAS, { error: "Elige tu talla de camiseta." }),
  restriccionesAlimentarias: z.string().trim().max(200, "Resume tus restricciones en 200 caracteres.").default(""),
  accesibilidad: z.string().trim().max(500, "Resume tus necesidades en 500 caracteres.").default(""),
});

const nivel14 = z.coerce.number({ error: "Elige un nivel del 1 al 4." }).int().min(1, "Elige un nivel del 1 al 4.").max(4, "Elige un nivel del 1 al 4.");

export const paso3Schema = z.object({
  rolPreferido: z.enum(ROLES_EQUIPO, { error: "Elige el rol que prefieres." }),
  niveles: z.object({ desarrollo: nivel14, n8n: nivel14, ia: nivel14, diseno: nivel14 }),
  tecnologias: z.array(z.string().trim().min(1).max(40)).max(20, "Elige como máximo 20 tecnologías.").default([]),
  otraTecnologia: z.string().trim().max(80).default(""),
  hackathonsPrevios: z.coerce.number({ error: "Escribe 0 si es tu primer hackathon." }).int().min(0, "Escribe 0 si es tu primer hackathon.").max(50),
});

export const paso4Schema = z
  .object({
    nombreEquipo: texto(3, 40, "el nombre del equipo"),
    track: z.enum(["T1", "T2", "T3"], { error: "Elige el track del equipo." }),
    problemaCandidato: texto(20, 280, "el problema candidato"),
    correosIntegrantes: z
      .array(z.email("Revisa los correos de tu equipo: uno no es válido."))
      .min(1, "Agrega al menos un correo: un equipo tiene de 2 a 5 personas.")
      .max(4, "Un equipo tiene como máximo 5 personas: agrega hasta 4 correos además del tuyo."),
  })
  .refine((d) => new Set(d.correosIntegrantes.map((c) => c.toLowerCase())).size === d.correosIntegrantes.length, {
    path: ["correosIntegrantes"],
    message: "Hay correos repetidos en la lista.",
  });

/** Cédula ecuatoriana de persona natural: provincia 01–24 o 30, tercer dígito < 6 y dígito verificador módulo 10. */
export function cedulaValida(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const provincia = Number(cedula.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  if (Number(cedula[2]) >= 6) return false;
  const digitos = cedula.split("").map(Number);
  const suma = digitos.slice(0, 9).reduce((acc, d, i) => {
    const v = i % 2 === 0 ? d * 2 : d;
    return acc + (v > 9 ? v - 9 : v);
  }, 0);
  return (10 - (suma % 10)) % 10 === digitos[9];
}

export const representanteSchema = z.object({
  nombres: texto(4, 120, "el nombre completo del representante"),
  cedula: z.string().trim().refine(cedulaValida, "La cédula del representante no es válida: revisa los 10 dígitos."),
  correo: z.email("Escribe un correo válido del representante."),
  celular: celular("Escribe el celular del representante (09XXXXXXXX)."),
  parentesco: texto(3, 40, "el parentesco"),
});

export const paso5Schema = z.object({
  aceptaReglas: z.literal(true, { error: "Para inscribirte debes aceptar las reglas y el código de conducta." }),
  aceptaDatos: z.literal(true, { error: "Para inscribirte debes autorizar el tratamiento de datos personales." }),
  aceptaImagen: z.boolean().default(false),
});

export const PDF_MAX_BYTES = 4 * 1024 * 1024;

/** El archivo de autorización: PDF real (cabecera %PDF-) y de hasta 4 MB (límite de Netlify, D-17). */
export function validarPdf(nombre: string, tipo: string, bytes: Uint8Array): string | null {
  if (bytes.byteLength === 0) return "Adjunta la autorización firmada en PDF.";
  if (bytes.byteLength > PDF_MAX_BYTES) return "La autorización pesa más de 4 MB: escanéala con menor resolución.";
  const cabecera = new TextDecoder().decode(bytes.slice(0, 5));
  if (cabecera !== "%PDF-" || (tipo && tipo !== "application/pdf") || !/\.pdf$/i.test(nombre)) {
    return "La autorización debe ser un archivo PDF.";
  }
  return null;
}

export type Paso1 = z.infer<typeof paso1Schema>;
export type Paso2 = z.infer<typeof paso2Schema>;
export type Paso3 = z.infer<typeof paso3Schema>;
export type Paso4 = z.infer<typeof paso4Schema>;
export type Representante = z.infer<typeof representanteSchema>;

/** Primer mensaje de error por campo, para mostrarlo junto a cada input. */
export function erroresPorCampo(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const clave = issue.path.join(".") || "_";
    out[clave] ??= issue.message;
  }
  return out;
}
