/**
 * Genera public/plantilla-autorizacion.pdf: plantilla de autorización del representante legal
 * para la categoría Junior. El formato oficial depende del DECE y de Legal (guía §12, decisión 6):
 * este PDF es un BORRADOR y lo indica en su encabezado.
 *
 * Uso: npx tsx scripts/generar-plantilla-autorizacion.ts
 */
import { writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { EVENT } from "../config/event";

async function main() {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Autorización del representante legal · Hackathon EduTech");
  pdf.setLanguage("es-EC");
  const page = pdf.addPage([595, 842]); // A4
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.055, 0.106, 0.239);
  let y = 790;

  const linea = (texto: string, opts: { font?: typeof normal; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const size = opts.size ?? 11;
    const font = opts.font ?? normal;
    // Ajuste de línea simple a 480 pt de ancho.
    let actual = "";
    for (const p of texto.split(" ")) {
      const prueba = actual ? `${actual} ${p}` : p;
      if (font.widthOfTextAtSize(prueba, size) > 480) {
        page.drawText(actual, { x: 57, y, size, font, color: opts.color ?? navy });
        y -= size * 1.5;
        actual = p;
      } else actual = prueba;
    }
    if (actual) page.drawText(actual, { x: 57, y, size, font, color: opts.color ?? navy });
    y -= size * 1.5;
  };
  const espacio = (n = 10) => (y -= n);
  const campo = (etiqueta: string) => {
    linea(`${etiqueta}: ____________________________________________________`);
    espacio(4);
  };

  linea("BORRADOR · formato pendiente de aprobación del DECE y del área legal", { font: negrita, size: 9, color: rgb(0.76, 0.25, 0.18) });
  espacio(6);
  linea("Autorización del representante legal", { font: negrita, size: 18 });
  linea(`${EVENT.nombre} · 6 y 7 de noviembre de 2026 · ${EVENT.sede.nombre}, ${EVENT.sede.ciudad}`, { size: 10 });
  espacio(14);
  linea("Datos del representante legal", { font: negrita, size: 12 });
  campo("Nombres y apellidos");
  campo("Cédula");
  campo("Parentesco");
  campo("Celular");
  campo("Correo");
  espacio(8);
  linea("Datos de la persona participante (14 a 17 años)", { font: negrita, size: 12 });
  campo("Nombres y apellidos");
  campo("Fecha de nacimiento");
  campo("Institución educativa");
  espacio(8);
  linea("Declaración", { font: negrita, size: 12 });
  linea(
    "Autorizo a la persona menor de edad indicada a participar en el hackathon, en las fechas y la sede señaladas. Declaro conocer que: (1) la sede cierra a las 21:00 del viernes y los menores no permanecen en ella después de esa hora; (2) siempre contará con un adulto responsable identificado por la organización; (3) en el evento se trabaja solo con datos sintéticos; (4) sus datos personales se tratan únicamente para organizar el evento, conforme a la LOPDP, y se anonimizan 12 meses después.",
  );
  espacio(6);
  linea("Autorizo el uso de su imagen en la comunicación del evento:   [  ] Sí     [  ] No");
  espacio(40);
  linea("_______________________________                _______________________________");
  linea("Firma del representante legal                                Fecha");
  espacio(20);
  linea("Sube este documento firmado y escaneado en PDF (máximo 4 MB) en el último paso de la inscripción.", { size: 9 });

  writeFileSync("public/plantilla-autorizacion.pdf", await pdf.save());
  console.log("Generado public/plantilla-autorizacion.pdf");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
