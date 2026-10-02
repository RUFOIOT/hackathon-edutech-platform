/**
 * Sitio público estático (GitHub Pages, D-44). `npm run build:pages` exporta solo las páginas
 * públicas con NEXT_PUBLIC_SITIO_ESTATICO=true y un basePath (/<repo>). Ahí no existen el
 * registro, el portal ni el panel: los enlaces a esas rutas apuntan a la plataforma completa
 * (NEXT_PUBLIC_URL_PLATAFORMA) o desaparecen si aún no hay URL.
 */
export const SITIO_ESTATICO = process.env.NEXT_PUBLIC_SITIO_ESTATICO === "true";
const URL_PLATAFORMA = (process.env.NEXT_PUBLIC_URL_PLATAFORMA ?? "").replace(/\/$/, "");
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Archivo de /public con el basePath (next/image y <a> no lo agregan solos en la exportación). */
export function asset(ruta: string): string {
  return `${BASE_PATH}${ruta}`;
}

/** Ruta de la plataforma (registro, portal, resultados). `null` si no está disponible aquí. */
export function enlacePlataforma(ruta: string): string | null {
  if (!SITIO_ESTATICO) return ruta;
  return URL_PLATAFORMA ? `${URL_PLATAFORMA}${ruta}` : null;
}
