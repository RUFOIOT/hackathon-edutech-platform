import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { EVENT } from "@/config/event";

export const certificadoSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  equipo: z.string().trim().min(1).max(80),
  tipo: z.enum(["participacion", "finalista", "ganador"]),
  premio: z.string().trim().max(120).nullish(),
});
export type DatosCertificado = z.infer<typeof certificadoSchema>;

const TITULO: Record<DatosCertificado["tipo"], string> = {
  participacion: "Certificado de participación",
  finalista: "Certificado de finalista",
  ganador: "Certificado de reconocimiento",
};

// Paleta del logo de Eight Academy (D-38).
const NAVY = rgb(0.055, 0.106, 0.239);
const FRANJA = [rgb(0.416, 0.639, 0.863), rgb(0.91, 0.627, 0.69), rgb(0.435, 0.702, 0.549), rgb(0.941, 0.698, 0.227)];

/**
 * Certificado A4 horizontal (WF-09). Usa las fuentes estándar de PDF (WinAnsi: cubren tildes y ñ);
 * cualquier otro carácter se reemplaza para que el PDF nunca falle por un nombre.
 */
export async function generarCertificado(d: DatosCertificado): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${TITULO[d.tipo]} · ${EVENT.nombre}`);
  pdf.setAuthor(EVENT.organiza);
  const pagina = pdf.addPage([842, 595]);
  const { width, height } = pagina.getSize();
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const seguro = (s: string) => s.replace(/[^ -~ -ÿ]/g, "?");

  FRANJA.forEach((color, i) => pagina.drawRectangle({ x: (width / 4) * i, y: height - 14, width: width / 4, height: 14, color }));
  FRANJA.forEach((color, i) => pagina.drawRectangle({ x: (width / 4) * i, y: 0, width: width / 4, height: 6, color }));

  const centrado = (texto: string, y: number, size: number, font = sans, color = NAVY) => {
    const t = seguro(texto);
    const ancho = font.widthOfTextAtSize(t, size);
    // Reduce el tamaño si el texto no cabe en el ancho útil.
    const s = ancho > width - 120 ? (size * (width - 120)) / ancho : size;
    pagina.drawText(t, { x: (width - font.widthOfTextAtSize(t, s)) / 2, y, size: s, font, color });
  };

  centrado(EVENT.nombre, height - 80, 16);
  centrado(TITULO[d.tipo], height - 160, 40, serif);
  centrado("Se otorga a", height - 215, 14);
  centrado(d.nombre, height - 275, 36, serif);
  centrado(`integrante del equipo ${d.equipo}`, height - 315, 14);
  const motivo =
    d.tipo === "ganador" && d.premio
      ? `por obtener: ${d.premio}`
      : d.tipo === "finalista"
        ? "por llegar a la final del Show and Tell"
        : "por construir en vivo una solución para la educación";
  centrado(motivo, height - 345, 14);
  centrado(`Quito, 6 y 7 de noviembre de 2026 · ${EVENT.organiza}`, 70, 11);
  return pdf.save();
}
