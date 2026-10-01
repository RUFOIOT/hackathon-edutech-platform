import { z } from "zod";

/** Formulario de entrega (prompt §5.3, Guía del Hacker §6). */

const urlHttps = (mensaje: string) =>
  z
    .string()
    .trim()
    .url(mensaje)
    .refine((u) => u.startsWith("https://"), "Usa un enlace que empiece con https://.");

export const entregaSchema = z
  .object({
    modoDemo: z.enum(["url", "local"], { error: "Indica si tu demo está desplegada o se ejecuta localmente." }),
    demoUrl: z.string().trim().optional(),
    videoUrl: z.union([z.literal(""), urlHttps("El enlace del video de respaldo no es válido.")]).default(""),
    datosSinteticos: z.literal(true, { error: "Declara que usaron solo datos sintéticos o anonimizados." }),
    priorWork: z.literal(true, { error: "Declara el trabajo previo en PRIOR_WORK.md y marca la casilla." }),
    aiUsage: z.literal(true, { error: "Declara el uso de IA en AI_USAGE.md y marca la casilla." }),
  })
  .superRefine((d, ctx) => {
    if (d.modoDemo !== "url") return;
    const r = urlHttps("Pega el enlace de tu demo desplegada (https://…).").safeParse(d.demoUrl ?? "");
    if (!r.success) ctx.addIssue({ code: "custom", path: ["demoUrl"], message: r.error.issues[0]?.message ?? "Enlace inválido." });
  });

export type Entrega = z.infer<typeof entregaSchema>;

export const PITCH_MAX_BYTES = 20 * 1024 * 1024;

export function validarPitch(nombre: string, tipo: string, tamano: number): string | null {
  if (tamano === 0) return "Adjunta el PDF del pitch.";
  if (tamano > PITCH_MAX_BYTES) return "El PDF del pitch pesa más de 20 MB: expórtalo con imágenes comprimidas.";
  if ((tipo && tipo !== "application/pdf") || !/\.pdf$/i.test(nombre)) return "El pitch debe ser un archivo PDF.";
  return null;
}
