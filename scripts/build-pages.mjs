/**
 * Exporta el sitio público estático para GitHub Pages (D-44): `npm run build:pages`.
 *
 * Next.js no puede exportar en estático una app con rutas API, Server Actions y middleware, así
 * que se trabaja sobre una copia en .pages-build/ con solo las páginas públicas (portada, tracks,
 * guías, rúbrica, privacidad) y se deja el resultado en out-pages/. La app completa (registro,
 * portal, jurado, panel) se despliega en Netlify (docs/DEPLOY.md).
 *
 * Variables: BASE_PATH (p. ej. /hackathon-edutech-platform), NEXT_PUBLIC_URL_PLATAFORMA (opcional:
 * URL de la app completa para los botones de inscripción e ingreso).
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const raiz = process.cwd();
const copia = path.join(raiz, ".pages-build");
const salida = path.join(raiz, "out-pages");
const basePath = (process.env.BASE_PATH ?? "").replace(/\/$/, "");

// Rutas que necesitan servidor: no existen en el sitio estático.
const DINAMICAS = ["app/api", "app/admin", "app/mi-equipo", "app/jurado", "app/registro", "app/ingresar", "app/auth", "app/pantalla", "app/sin-acceso", "app/resultados", "middleware.ts"];
const OMITIR = new Set(["node_modules", ".next", ".git", ".pages-build", "out-pages", "test-results", "playwright-report", ".firebase-data", "template-repo", "tests", ".env.local", ".env"]);

rmSync(copia, { recursive: true, force: true });
rmSync(salida, { recursive: true, force: true });
mkdirSync(copia);
for (const entrada of readdirSync(raiz)) if (!OMITIR.has(entrada)) cpSync(path.join(raiz, entrada), path.join(copia, entrada), { recursive: true });
symlinkSync(path.join(raiz, "node_modules"), path.join(copia, "node_modules"), "dir");
for (const r of DINAMICAS) rmSync(path.join(copia, r), { recursive: true, force: true });

writeFileSync(
  path.join(copia, "next.config.ts"),
  `import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export",
  basePath: ${JSON.stringify(basePath)},
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};
export default config;
`,
);

execSync("npx next build", {
  cwd: copia,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SITIO_ESTATICO: "true",
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_TELEMETRY_DISABLED: "1",
    // Sin emuladores ni credenciales: las páginas públicas no tocan Firebase.
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false",
    FIRESTORE_EMULATOR_HOST: "",
    APP_FECHA_SIMULADA: "",
  },
});

cpSync(path.join(copia, "out"), salida, { recursive: true });
// GitHub Pages ignora las carpetas que empiezan con "_" (como _next) si no hay .nojekyll.
writeFileSync(path.join(salida, ".nojekyll"), "");
if (!existsSync(path.join(salida, "index.html"))) throw new Error("La exportación no generó index.html");
console.log(`Sitio estático listo en out-pages/ (basePath "${basePath || "/"}")`);
