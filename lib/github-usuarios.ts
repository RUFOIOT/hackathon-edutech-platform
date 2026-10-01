import "server-only";

/**
 * Verifica que un usuario de GitHub exista (registro, paso 2). Usa la API pública; en la Fase 4
 * se autentica con la GitHub App para tener más cuota. GITHUB_API_BASE permite apuntar a un
 * servidor simulado en tests.
 *
 * Si GitHub no responde o limita la cuota, no se bloquea la inscripción: se acepta y se marca
 * para revisión (RUNBOOK: "GitHub limita la API").
 */
export type ResultadoGithub = "existe" | "no-existe" | "sin-verificar";

export async function verificarUsuarioGithub(usuario: string): Promise<ResultadoGithub> {
  const base = process.env.GITHUB_API_BASE ?? "https://api.github.com";
  try {
    const res = await fetch(`${base}/users/${encodeURIComponent(usuario)}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "edutech-eight-academy" },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (res.status === 200) return "existe";
    if (res.status === 404) return "no-existe";
    return "sin-verificar";
  } catch {
    return "sin-verificar";
  }
}
