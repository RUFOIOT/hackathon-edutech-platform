/**
 * Logger del servidor. Ningún log puede contener correos, teléfonos ni tokens (prompt §10):
 * todo mensaje y contexto pasa por `redactar` antes de escribirse.
 */
const PATRONES: [RegExp, string][] = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[correo]"],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[jwt]"],
  [/\b(?:sk|pk|rk)[-_][A-Za-z0-9_-]{16,}/g, "[clave]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "[token-github]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[clave-aws]"],
  [/\+?\d[\d\s-]{7,}\d/g, "[telefono]"],
];

const CLAVES_SENSIBLES = /^(email|correo|telefono|celular|phone|token|idToken|password|secret|documento|cedula)$/i;

export function redactar(valor: unknown): unknown {
  if (typeof valor === "string") return PATRONES.reduce((s, [re, rep]) => s.replace(re, rep), valor);
  if (Array.isArray(valor)) return valor.map(redactar);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, CLAVES_SENSIBLES.test(k) ? "[redactado]" : redactar(v)]),
    );
  }
  return valor;
}

type Nivel = "info" | "warn" | "error";

function escribir(nivel: Nivel, mensaje: string, contexto?: Record<string, unknown>) {
  const linea = JSON.stringify({
    nivel,
    mensaje: redactar(mensaje),
    ...(contexto ? { contexto: redactar(contexto) } : {}),
    ts: new Date().toISOString(),
  });
  if (nivel === "error") console.error(linea);
  else console.warn(linea);
}

export const log = {
  info: (m: string, c?: Record<string, unknown>) => escribir("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => escribir("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => escribir("error", m, c),
};
