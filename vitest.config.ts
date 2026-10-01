import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      {
        resolve: { alias },
        // Requiere los emuladores: se ejecuta con `npm run test:rules`.
        test: { name: "rules", include: ["tests/rules/**/*.test.ts"], environment: "node", testTimeout: 20000, fileParallelism: false },
      },
    ],
  },
});
