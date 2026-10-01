import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "template-repo/**", "n8n/**", "next-env.d.ts", ".firebase-data/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Ningún log debe contener correos, teléfonos ni tokens: se centraliza en lib/log.ts.
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  { files: ["scripts/**", "tests/**"], rules: { "no-console": "off" } },
];

export default config;
