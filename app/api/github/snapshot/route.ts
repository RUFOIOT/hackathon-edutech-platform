import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { tomarSnapshot } from "@/lib/github/servicio";
import { verificarFirma } from "@/lib/hmac";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cuerpoSchema = z.union([z.object({ teamId: z.string().regex(/^[a-z0-9-]{1,60}$/) }), z.object({ todos: z.literal(true) })]);

/**
 * POST /api/github/snapshot — lo invoca n8n (WF-04 cada 15 min, WF-06 al code freeze).
 * Cuerpo: `{ "teamId": "slug" }` o `{ "todos": true }`. Firmado con X-Signature + X-Timestamp.
 * Responde un resumen por equipo con las alertas rojas para que n8n avise a la mesa técnica.
 */
export async function POST(req: NextRequest) {
  const cuerpo = await req.text();
  const firma = verificarFirma({
    secreto: process.env.N8N_SHARED_SECRET ?? "",
    cuerpo,
    timestamp: req.headers.get("x-timestamp"),
    firma: req.headers.get("x-signature"),
  });
  if (!firma.ok) return NextResponse.json({ error: "Firma inválida", motivo: firma.motivo }, { status: 401 });

  let datos: z.infer<typeof cuerpoSchema>;
  try {
    datos = cuerpoSchema.parse(JSON.parse(cuerpo));
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido: usa {"teamId":"slug"} o {"todos":true}' }, { status: 400 });
  }

  const equipos =
    "teamId" in datos
      ? [datos.teamId]
      : (await adminDb().collection("repositories").where("validado", "==", true).select().get()).docs.map((d) => d.id);

  const resultados = [];
  // De a 3 a la vez: respeta la cuota de la API de GitHub sin alargar demasiado la llamada.
  for (let i = 0; i < equipos.length; i += 3) {
    const lote = await Promise.all(
      equipos.slice(i, i + 3).map(async (teamId) => {
        try {
          const s = await tomarSnapshot(teamId);
          if (!s) return { teamId, ok: false, error: "Sin repositorio registrado" };
          return {
            teamId,
            ok: true,
            commitsEnVentana: s.commitsEnVentana,
            autores: s.autores.length,
            checkpoint1: s.checkpoint1,
            checkpoint2: s.checkpoint2,
            alertasRojas: s.alertas.filter((a) => a.nivel === "roja").map((a) => a.detalle),
            alertasAmbar: s.alertas.filter((a) => a.nivel === "ambar").map((a) => a.detalle),
          };
        } catch (err) {
          log.warn("Snapshot fallido", { teamId, error: err instanceof Error ? err.message : "desconocido" });
          return { teamId, ok: false, error: "No se pudo leer el repositorio" };
        }
      }),
    );
    resultados.push(...lote);
  }
  return NextResponse.json({ resultados });
}
