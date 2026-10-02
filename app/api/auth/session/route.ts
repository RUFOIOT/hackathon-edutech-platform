import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { identidadDeUid, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth/session";
import { destinoSeguro, inicioPara } from "@/lib/auth/roles";
import { log } from "@/lib/log";
import { ipDe, limitar, mensajeLimite } from "@/lib/seguridad/limite";

/** Protección CSRF básica: la petición debe venir del mismo origen que la app. */
function mismoOrigen(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  return origin !== null && origin === req.nextUrl.origin;
}

/**
 * Intercambia el ID token del enlace mágico por una cookie de sesión httpOnly.
 * Solo acepta tokens emitidos en los últimos 5 minutos (inicio de sesión reciente).
 */
export async function POST(req: NextRequest) {
  if (!mismoOrigen(req)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const limite = await limitar("sesion", ipDe(req.headers));
  if (!limite.ok) return NextResponse.json({ error: mensajeLimite(limite) }, { status: 429, headers: { "Retry-After": String(limite.reintentarEnSeg) } });

  const body = (await req.json().catch(() => null)) as { idToken?: unknown; siguiente?: unknown } | null;
  if (!body || typeof body.idToken !== "string") {
    return NextResponse.json({ error: "Falta el token de inicio de sesión." }, { status: 400 });
  }

  try {
    const decoded = await adminAuth().verifyIdToken(body.idToken, true);
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      return NextResponse.json({ error: "El enlace ya expiró. Pide uno nuevo." }, { status: 401 });
    }
    const expiresIn = SESSION_DAYS * 24 * 60 * 60 * 1000;
    const cookie = await adminAuth().createSessionCookie(body.idToken, { expiresIn });
    const id = await identidadDeUid(decoded.uid);
    const destino = destinoSeguro(body.siguiente) ?? inicioPara(id);

    const res = NextResponse.json({ destino });
    res.cookies.set(SESSION_COOKIE, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn / 1000,
    });
    return res;
  } catch (err) {
    log.warn("No se pudo crear la sesión", { error: err instanceof Error ? err.message : "desconocido" });
    return NextResponse.json({ error: "No pudimos verificar tu enlace. Pide uno nuevo." }, { status: 401 });
  }
}

/** Cierra la sesión y revoca los tokens en Firebase. */
export async function DELETE(req: NextRequest) {
  if (!mismoOrigen(req)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const decoded = await adminAuth().verifySessionCookie(token);
      await adminAuth().revokeRefreshTokens(decoded.sub);
    } catch {
      // Cookie ya inválida: basta con borrarla.
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
