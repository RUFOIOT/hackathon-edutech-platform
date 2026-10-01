import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // firebase-admin usa módulos nativos de Node: no se empaqueta en el bundle del servidor.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
