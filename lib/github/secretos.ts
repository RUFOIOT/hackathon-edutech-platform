/**
 * Detección básica de secretos en el árbol actual del repositorio (prompt §8.1). No reemplaza a
 * gitleaks (que corre en el Action de la plantilla sobre todo el historial): es una alerta rápida
 * para el dashboard. Nunca guarda el secreto: solo tipo, archivo, línea y una vista enmascarada.
 */
export interface Hallazgo {
  tipo: string;
  archivo: string;
  linea: number;
  muestra: string; // enmascarada: primeros 4 caracteres + "…"
}

const PATRONES: { tipo: string; re: RegExp }[] = [
  { tipo: "Clave de API tipo sk- (OpenAI, Anthropic u otras)", re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g },
  { tipo: "Token de GitHub", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}/g },
  { tipo: "Clave de acceso de AWS", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { tipo: "Clave de Resend", re: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/g },
  { tipo: "Clave privada (PEM)", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { tipo: "Cuenta de servicio de Google/Firebase", re: /"type"\s*:\s*"service_account"/g },
];

/** JWT cuyo payload declara role service_role (clave de servicio de Supabase). */
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;

function payloadJwt(segmento: string): Record<string, unknown> | null {
  try {
    const json = Buffer.from(segmento.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const enmascarar = (s: string) => `${s.slice(0, 4)}…`;

/** Archivos que se analizan: texto, de tamaño razonable, fuera de dependencias y binarios. */
export function debeAnalizarse(path: string, size: number | undefined): boolean {
  if (size !== undefined && size > 512 * 1024) return false;
  if (/(^|\/)(node_modules|\.git|dist|build|\.next|vendor)\//.test(path)) return false;
  return !/\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|mp4|mov|mp3|woff2?|ttf|otf|lock|svg)$/i.test(path);
}

export function detectarSecretos(archivo: string, contenido: string): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  contenido.split("\n").forEach((texto, i) => {
    for (const { tipo, re } of PATRONES) {
      for (const m of texto.matchAll(re)) hallazgos.push({ tipo, archivo, linea: i + 1, muestra: enmascarar(m[0]) });
    }
    for (const m of texto.matchAll(JWT)) {
      const payload = payloadJwt(m[1]!);
      if (payload?.role === "service_role") {
        hallazgos.push({ tipo: "Clave service_role de Supabase", archivo, linea: i + 1, muestra: enmascarar(m[0]) });
      }
    }
  });
  return hallazgos;
}

/** Un `.env` (o variante con valores) versionado es en sí una alerta, aunque no coincida un patrón. */
export function esArchivoEnv(path: string): boolean {
  const nombre = path.split("/").pop() ?? "";
  return /^\.env(\..+)?$/.test(nombre) && !/\.(example|sample|template)$/.test(nombre);
}
