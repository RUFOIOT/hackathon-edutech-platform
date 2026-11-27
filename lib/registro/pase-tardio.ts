/**
 * Pase tardío: con las inscripciones cerradas, la organización puede habilitar a personas puntuales
 * para que se unan a un equipo concreto. Se configura solo en el entorno (nunca en el repo, porque
 * contiene correos): PASE_TARDIO="correo@ejemplo.com:team-id,otro@ejemplo.com:otro-team".
 * El pase vale para un único correo y un único equipo; al inscribirse deja de aplicar porque la
 * persona ya es participante.
 */
export interface PaseTardio {
  email: string;
  teamId: string;
}

export function pasesTardios(valor: string | undefined = process.env.PASE_TARDIO): PaseTardio[] {
  return (valor ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => {
      const i = p.lastIndexOf(":");
      if (i <= 0) return [];
      const email = p.slice(0, i).trim().toLowerCase();
      const teamId = p.slice(i + 1).trim();
      return email.includes("@") && teamId ? [{ email, teamId }] : [];
    });
}

/** El pase del correo dado, si la organización lo habilitó. */
export function paseTardioDe(email: string | null | undefined, valor?: string): PaseTardio | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return pasesTardios(valor).find((p) => p.email === e) ?? null;
}
