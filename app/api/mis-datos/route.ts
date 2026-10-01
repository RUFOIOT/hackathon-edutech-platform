import { NextResponse } from "next/server";
import { getIdentidad } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/**
 * Derecho de acceso (LOPDP): descarga en JSON de los datos personales de quien lo pide.
 * Incluye perfil, consentimientos con su versión y el estado de la autorización (sin el documento).
 */
export async function GET() {
  const id = await getIdentidad();
  if (!id?.esParticipante) return NextResponse.json({ error: "Ingresa para descargar tus datos." }, { status: 401 });
  const db = adminDb();
  const [p, consents, guardian, checkins] = await Promise.all([
    db.doc(`participants/${id.uid}`).get(),
    db.collection("consents").where("participantId", "==", id.uid).get(),
    db.doc(`guardians/${id.uid}`).get(),
    db.collection("checkins").where("participantId", "==", id.uid).get(),
  ]);
  const datos = {
    generadoEl: new Date().toISOString(),
    participante: p.data(),
    consentimientos: consents.docs.map((d) => d.data()),
    autorizacion: guardian.exists
      ? { representante: guardian.get("nombre"), parentesco: guardian.get("parentesco"), estado: guardian.get("estado") }
      : null,
    checkins: checkins.docs.map((d) => d.data()),
  };
  return new NextResponse(JSON.stringify(datos, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mis-datos-edutech.json"',
      "Cache-Control": "no-store",
    },
  });
}
