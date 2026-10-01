import { redirect } from "next/navigation";
import { requireSesion } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { BotonSalir } from "@/components/boton-salir";

export const metadata = { title: "Mi equipo" };

// Esqueleto de la Fase 1: comprueba sesión y equipo. El portal completo es la Fase 3.
export default async function MiEquipo() {
  const id = await requireSesion("/mi-equipo");
  if (!id.esParticipante) redirect("/registro");

  const participante = await adminDb().doc(`participants/${id.uid}`).get();
  const teamId = participante.get("teamId") as string | null;
  const equipo = teamId ? await adminDb().doc(`teams/${teamId}`).get() : null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Mi equipo</h1>
        <BotonSalir />
      </div>
      {equipo?.exists ? (
        <p className="mt-4">
          {String(equipo.get("nombre"))} · {String(equipo.get("track"))}
        </p>
      ) : (
        <p className="mt-4 text-muted">Aún no tienes equipo. La organización te asignará uno en el matchmaking.</p>
      )}
    </section>
  );
}
