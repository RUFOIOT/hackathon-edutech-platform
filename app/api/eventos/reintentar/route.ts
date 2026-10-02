import { NextResponse, type NextRequest } from "next/server";
import { reintentarPendientes } from "@/lib/eventos";
import { leerPeticionFirmada } from "@/lib/n8n";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/eventos/reintentar — WF-00 lo llama cada 5 minutos para reenviar los eventos del
 * outbox que n8n no recibió (D-19). Cuerpo firmado: `{}`.
 */
export async function POST(req: NextRequest) {
  const peticion = await leerPeticionFirmada(req);
  if (!peticion.ok) return peticion.respuesta;
  return NextResponse.json(await reintentarPendientes(), { headers: { "Cache-Control": "no-store" } });
}
