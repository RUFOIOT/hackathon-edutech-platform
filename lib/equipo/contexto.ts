import "server-only";
import { getIdentidad } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { ErrorRegistro } from "@/lib/registro/servicio";

/** Para Server Actions del portal: exige sesión de participante con equipo. */
export async function contextoEquipo() {
  const id = await getIdentidad();
  if (!id?.esParticipante) throw new ErrorRegistro("Tu sesión expiró. Vuelve a ingresar.");
  const p = await adminDb().doc(`participants/${id.uid}`).get();
  const teamId = p.get("teamId") as string | null;
  if (!teamId) throw new ErrorRegistro("Necesitas un equipo para esta acción.");
  return { uid: id.uid, teamId };
}
