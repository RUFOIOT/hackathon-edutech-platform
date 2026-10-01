import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { EVENT } from "@/config/event";
import { adminDb } from "@/lib/firebase/admin";
import { registrarMovimientoTag } from "@/lib/github/servicio";
import { movimientoDeTag, verificarFirmaGithub } from "@/lib/github/webhook";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * POST /api/github/webhook — eventos de la GitHub App instalada en la organización.
 * Verifica X-Hub-Signature-256. Registra en tiempo real cualquier movimiento del tag `entrega`
 * (push/create/delete) y la actividad de push en ramas.
 */
export async function POST(req: NextRequest) {
  const cuerpo = await req.text();
  if (!verificarFirmaGithub(process.env.GITHUB_WEBHOOK_SECRET ?? "", cuerpo, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }
  const evento = req.headers.get("x-github-event") ?? "";
  const entrega = req.headers.get("x-github-delivery") ?? crypto.randomUUID();
  if (evento === "ping") return NextResponse.json({ ok: true });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(cuerpo) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const movimiento = movimientoDeTag(evento, payload, EVENT.tagEntrega);
  if (movimiento) {
    const r = await registrarMovimientoTag(entrega, movimiento);
    if (r.trasFreeze) log.warn("Tag de entrega movido después del code freeze", { teamId: r.teamId, accion: movimiento.accion });
    return NextResponse.json({ ok: true, registrado: "tag", trasFreeze: r.trasFreeze }, { status: 202 });
  }

  // Push a una rama: actualiza la última actividad para el dashboard (sin esperar al snapshot).
  const repo = (payload.repository as { full_name?: string } | undefined)?.full_name;
  if (evento === "push" && repo && typeof payload.ref === "string" && payload.ref.startsWith("refs/heads/")) {
    const q = await adminDb().collection("repositories").where("fullName", "==", repo.toLowerCase()).limit(1).get();
    const doc = q.docs[0];
    if (doc) await doc.ref.update({ ultimoPushAt: FieldValue.serverTimestamp(), pushes: FieldValue.increment(1) });
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
