/** Clave de localStorage con el correo al que se envió el enlace mágico (requisito de Firebase). */
export const CORREO_PENDIENTE_KEY = "edutech:correoPendiente";

/** Qué decir cuando Firebase no envía el enlace mágico (no mostrar "auth/…" al usuario). */
export function errorAlEnviarEnlace(err: unknown): string {
  const codigo = (err as { code?: string } | null)?.code ?? "";
  if (codigo === "auth/quota-exceeded") {
    return "Hoy alcanzamos el límite de enlaces de ingreso. Inténtalo en unas horas o escribe a la organización para que te ayude.";
  }
  if (codigo === "auth/invalid-email") return "Escribe un correo válido, por ejemplo nombre@dominio.com.";
  if (codigo === "auth/too-many-requests") return "Pediste varios enlaces seguidos. Espera unos minutos y vuelve a intentarlo.";
  if (codigo === "auth/network-request-failed") return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
  return "No pudimos enviar el enlace. Inténtalo de nuevo en unos minutos.";
}
