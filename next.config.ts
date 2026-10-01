import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // firebase-admin usa módulos nativos de Node: no se empaqueta en el bundle del servidor.
  serverExternalPackages: ["firebase-admin"],
  // La autorización Junior (PDF ≤ 4 MB) viaja en una Server Action. Netlify limita el cuerpo a ~6 MB (D-17).
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
