import { NextResponse } from "next/server";
import { getIdentidad } from "@/lib/auth/session";
import { adminAuth } from "@/lib/firebase/admin";
import { limitar, mensajeLimite } from "@/lib/seguridad/limite";

export const dynamic = "force-dynamic";

/**
 * Token personalizado de corta duración para que el SDK cliente escuche cambios en tiempo real
 * (onSnapshot) con la identidad de la sesión. Las reglas de Firestore deciden qué puede leer;
 * el cliente sigue sin poder escribir (D-37).
 */
export async function GET() {
  const id = await getIdentidad();
  if (!id) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  const limite = await limitar("tokenCliente", id.uid);
  if (!limite.ok) return NextResponse.json({ error: mensajeLimite(limite) }, { status: 429, headers: { "Retry-After": String(limite.reintentarEnSeg) } });
  const token = await adminAuth().createCustomToken(id.uid);
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
