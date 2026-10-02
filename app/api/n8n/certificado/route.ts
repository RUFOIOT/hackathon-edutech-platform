import { NextResponse, type NextRequest } from "next/server";
import { leerPeticionFirmada } from "@/lib/n8n";
import { certificadoSchema, generarCertificado } from "@/lib/n8n/certificado";

export const dynamic = "force-dynamic";

/**
 * POST /api/n8n/certificado — WF-09 pide un PDF por integrante al publicar resultados.
 * Cuerpo firmado: `{ "nombre", "equipo", "tipo": "participacion|finalista|ganador", "premio"? }`.
 * No guarda nada: el PDF se genera al vuelo y n8n lo adjunta al correo.
 */
export async function POST(req: NextRequest) {
  const peticion = await leerPeticionFirmada(req);
  if (!peticion.ok) return peticion.respuesta;
  let entrada: unknown = null;
  try {
    entrada = JSON.parse(peticion.cuerpo);
  } catch {
    // cae en la validación de abajo
  }
  const datos = certificadoSchema.safeParse(entrada);
  if (!datos.success) return NextResponse.json({ error: "Datos del certificado inválidos." }, { status: 400 });
  const pdf = await generarCertificado(datos.data);
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="certificado.pdf"', "Cache-Control": "no-store" },
  });
}
