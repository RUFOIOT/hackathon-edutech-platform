import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * Tests de extremo a extremo. Corren contra el build de producción (`next start`).
 * Las fases con login (registro, entrega, evaluación) arrancarán además los emuladores.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "es-EC" },
  projects: [
    { name: "movil", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-edutech" },
  },
});
