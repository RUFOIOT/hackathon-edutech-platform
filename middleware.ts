import { NextResponse, type NextRequest } from "next/server";

/**
 * Filtro rápido en el edge: sin cookie de sesión no se entra a rutas privadas.
 * La verificación real (firma, revocación y rol) ocurre en el servidor con firebase-admin
 * (lib/auth/session.ts), que no puede ejecutarse en el edge.
 */
export function middleware(req: NextRequest) {
  if (req.cookies.has("__session")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/ingresar";
  url.search = `?siguiente=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/mi-equipo/:path*", "/jurado/:path*", "/admin/:path*"],
};
