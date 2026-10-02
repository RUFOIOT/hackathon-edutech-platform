import type { NextConfig } from "next";

const produccion = process.env.NODE_ENV === "production";
const emuladores = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

/**
 * Política de contenido (D-42). Next.js inyecta scripts en línea para hidratar las páginas, así
 * que `script-src` admite 'unsafe-inline' (sin nonces, las páginas estáticas siguen en caché);
 * el resto queda cerrado: sin iframes de terceros, sin objetos, formularios solo hacia la app.
 * El SDK de Firebase habla con *.googleapis.com; los emuladores, con 127.0.0.1.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${produccion ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com${emuladores || !produccion ? " http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*" : ""}`,
  "frame-src https://*.firebaseapp.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(produccion && !emuladores ? ["upgrade-insecure-requests"] : []),
].join("; ");

const cabecerasSeguridad = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La cámara solo para el escáner de check-in (mismo origen); nada de micrófono ni ubicación.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // firebase-admin usa módulos nativos de Node: no se empaqueta en el bundle del servidor.
  serverExternalPackages: ["firebase-admin"],
  // La autorización Junior (PDF ≤ 4 MB) viaja en una Server Action. Netlify limita el cuerpo a ~6 MB (D-17).
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  async headers() {
    return [
      { source: "/:path*", headers: cabecerasSeguridad },
      // Respuestas con datos personales o firmadas: nunca en caché compartida.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
