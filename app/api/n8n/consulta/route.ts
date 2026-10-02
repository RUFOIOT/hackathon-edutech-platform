import { NextResponse, type NextRequest } from "next/server";
import { log } from "@/lib/log";
import { leerPeticionFirmada } from "@/lib/n8n";
import { consultaSchema, ejecutarConsulta } from "@/lib/n8n/consultas";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/n8n/consulta — datos que piden los workflows programados de n8n (n8n/README.md).
 * Cuerpo firmado: `{ "consulta": "checkpoints-en-riesgo", "hito": "checkpoint1" }`, etc.
 */
export async function POST(req: NextRequest) {
  const peticion = await leerPeticionFirmada(req);
  if (!peticion.ok) return peticion.respuesta;

  let datos;
  try {
    datos = consultaSchema.parse(JSON.parse(peticion.cuerpo));
  } catch {
    return NextResponse.json({ error: "Consulta inválida. Revisa n8n/README.md para ver las consultas disponibles." }, { status: 400 });
  }
  try {
    return NextResponse.json(await ejecutarConsulta(datos), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    log.error("Consulta de n8n fallida", { consulta: datos.consulta, error: err instanceof Error ? err.message : "desconocido" });
    return NextResponse.json({ error: "No se pudo completar la consulta." }, { status: 500 });
  }
}
