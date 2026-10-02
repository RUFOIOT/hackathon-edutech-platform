import { NextResponse } from "next/server";
import { tieneRol } from "@/lib/auth/roles";
import { getIdentidad } from "@/lib/auth/session";
import { auditarEn } from "@/lib/audit";
import { adminDb, adminStorage } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/**
 * Autorización firmada de un participante Junior: solo admin y comité (prompt §10).
 * Producción: redirige a una URL firmada de 5 minutos. Emuladores: transmite el archivo
 * (el emulador no firma URLs). Cada consulta queda en la auditoría.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const id = await getIdentidad();
  if (!id || !tieneRol(id, "admin", "comite")) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  const { uid } = await params;
  const g = await adminDb().doc(`guardians/${uid}`).get();
  const ruta = g.get("archivoPath") as string | undefined;
  if (!ruta) return NextResponse.json({ error: "Sin archivo." }, { status: 404 });
  const batch = adminDb().batch();
  auditarEn(batch, { actor: id.uid, accion: "guardian.file_view", entidad: "guardians", entidadId: uid });
  await batch.commit();
  const archivo = adminStorage().bucket().file(ruta);
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    const [contenido] = await archivo.download();
    return new NextResponse(new Uint8Array(contenido), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
  }
  const [url] = await archivo.getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 5 * 60_000 });
  return NextResponse.redirect(url);
}
