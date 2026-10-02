import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { strToU8, zipSync } from "fflate";
import { auditarEn } from "@/lib/audit";
import { puedeEntrarAdmin, tieneRol } from "@/lib/auth/roles";
import { getIdentidad } from "@/lib/auth/session";
import { aCsv, construirDataset } from "@/lib/dashboard/dataset";
import type { Fila } from "@/lib/dashboard/kpis";
import { ahora } from "@/lib/event/reloj";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/exportar?formato=csv|xlsx — "Exportar dataset" (prompt §6).
 * CSV: un ZIP con una hoja por archivo. XLSX: un libro con una hoja por tabla.
 * Datos de contacto solo para admin; puntajes solo para admin y comité (prompt §10).
 */
export async function GET(req: NextRequest) {
  const id = await getIdentidad();
  if (!id || !puedeEntrarAdmin(id, "/admin")) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  const formato = req.nextUrl.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";
  const conContacto = tieneRol(id, "admin");
  const conPuntajes = tieneRol(id, "admin", "comite");
  const dataset = await construirDataset(adminDb(), { ahora: ahora(), conContacto, conPuntajes });
  const sello = ahora().toISOString().slice(0, 16).replace(/[:T]/g, "-");

  const batch = adminDb().batch();
  auditarEn(batch, { actor: id.uid, accion: "dataset.export", entidad: "dataset", entidadId: formato, despues: { conContacto, conPuntajes } });
  await batch.commit();

  const hojas: [string, Fila[]][] = Object.entries(dataset).filter(([nombre]) => conPuntajes || nombre !== "puntajes");
  if (formato === "csv") {
    const zip = zipSync(Object.fromEntries(hojas.map(([nombre, filas]) => [`${nombre}.csv`, strToU8(aCsv(filas))])));
    return new NextResponse(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="edutech-dataset-${sello}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const libro = new ExcelJS.Workbook();
  libro.creator = "Plataforma Hackathon EduTech";
  for (const [nombre, filas] of hojas) {
    const hoja = libro.addWorksheet(nombre);
    const columnas: string[] = [...new Set(filas.flatMap((f) => Object.keys(f)))];
    hoja.columns = columnas.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(12, c.length + 2)) }));
    hoja.getRow(1).font = { bold: true };
    hoja.views = [{ state: "frozen", ySplit: 1 }];
    for (const f of filas) hoja.addRow(f);
  }
  const buffer = await libro.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="edutech-dataset-${sello}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
