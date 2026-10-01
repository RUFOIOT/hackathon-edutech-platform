import { requireJuez } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { BotonSalir } from "@/components/boton-salir";

export const metadata = { title: "Jurado" };

// Esqueleto de la Fase 1: comprueba el rol de juez y su sala. La hoja de evaluación es la Fase 5.
export default async function Jurado() {
  const id = await requireJuez("/jurado");
  const juez = await adminDb().doc(`judges/${id.uid}`).get();
  const roomId = juez.get("roomId") as string | null;
  const sala = roomId ? await adminDb().doc(`rooms/${roomId}`).get() : null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Jurado</h1>
        <BotonSalir />
      </div>
      <p className="mt-4">{sala?.exists ? `Sala: ${String(sala.get("nombre"))}` : "Aún no tienes sala asignada."}</p>
    </section>
  );
}
