import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const SECRETO_PRUEBAS = "secreto-e2e-n8n-solo-pruebas-0123456789";

/** Entorno común de la app en e2e: emuladores, simulado de n8n/GitHub y secretos de prueba. */
const ENV_APP = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-edutech",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "localhost",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-edutech.appspot.com",
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
  FIREBASE_PROJECT_ID: "demo-edutech",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  APP_BASE_URL: `http://localhost:${PORT}`,
  CHECKIN_QR_SECRET: "secreto-qr-e2e-solo-pruebas-0123456789",
  N8N_WEBHOOK_BASE_URL: "http://127.0.0.1:3999/n8n",
  N8N_SHARED_SECRET: SECRETO_PRUEBAS,
  GITHUB_API_BASE: "http://127.0.0.1:3999/github",
};

/**
 * Tests de extremo a extremo contra el build de producción (`next start`), con:
 * - emuladores de Firebase (auth, firestore, storage) → requiere Java 21+;
 * - servidor simulado de n8n y GitHub (tests/e2e/servidor-simulado.mjs);
 * - fecha simulada en periodo de inscripciones (solo se respeta con emuladores, D-16).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "es-EC" },
  projects: [
    { name: "movil", testMatch: /publico\.spec/, use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
    { name: "escritorio", testMatch: /publico\.spec/, use: { ...devices["Desktop Chrome"] } },
    // El registro se prueba a 360 px: el formulario se usa sobre todo desde el celular.
    { name: "registro", testMatch: /registro\.spec/, use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
    { name: "entrega", testMatch: /entrega\.spec/, use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
    // El jurado evalúa desde el celular.
    { name: "jurado", testMatch: /jurado\.spec/, use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
  ],
  webServer: [
    {
      command: "npx -y firebase-tools@15 emulators:start --only auth,firestore,storage --project demo-edutech",
      url: "http://127.0.0.1:9099",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Con SIGINT, Firebase apaga también los procesos Java de los emuladores.
      gracefulShutdown: { signal: "SIGINT", timeout: 15_000 },
    },
    {
      command: "node tests/e2e/servidor-simulado.mjs",
      url: "http://127.0.0.1:3999",
      reuseExistingServer: !process.env.CI,
      env: { N8N_SHARED_SECRET: SECRETO_PRUEBAS },
    },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: { ...ENV_APP, APP_FECHA_SIMULADA: "2026-10-15T10:00:00-05:00" },
    },
    {
      // Segunda instancia con la hora en plena ventana de hacking (repositorio y entrega).
      command: "npx next start -p 3101",
      url: "http://localhost:3101",
      reuseExistingServer: !process.env.CI,
      env: { ...ENV_APP, APP_FECHA_SIMULADA: "2026-11-07T11:00:00-05:00" },
    },
  ],
});
