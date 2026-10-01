import Link from "next/link";
import type { Timestamp } from "firebase-admin/firestore";
import { requireJuez } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { SALA_FINAL, rondaActiva } from "@/lib/jurado/servicio";
import { BotonSalir } from "@/components/boton-salir";

export const metadata = { title: "Jurado" };
export const dynamic = "force-dynamic";

const hora = (t: Timestamp | null | undefined) =>
  t ? new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t.toDate()) : "—";

/** Equipos asignados a la sala del juez, en orden de presentación, con el estado de su evaluación. */
export default async function Jurado() {
  const id = await requireJuez("/jurado");
  const db = adminDb();
  const [juez, ronda] = await Promise.all([db.doc(`judges/${id.uid}`).get(), rondaActiva()]);
  const enFinal = ronda === "final" && juez.get("final") === true;
  const roomId = enFinal ? SALA_FINAL : (juez.get("roomId") as string | null);

  if (!roomId || (ronda === "final" && !enFinal)) {
    return (
      <Contenedor>
        <p className="mt-6">{ronda === "final" ? "La semifinal terminó. No formas parte del jurado de la final." : "Aún no tienes sala asignada. Escribe a la coordinación."}</p>
      </Contenedor>
    );
  }

  const [sala, slots, puntajes, conflictos] = await Promise.all([
    db.doc(`rooms/${roomId}`).get(),
    db.collection("presentation_slots").where("ronda", "==", ronda).where("roomId", "==", roomId).get(),
    db.collection("scores").where("judgeId", "==", id.uid).where("ronda", "==", ronda).get(),
    db.collection("conflicts").where("judgeId", "==", id.uid).get(),
  ]);
  const evaluados = new Map(puntajes.docs.map((p) => [p.get("teamId") as string, p.get("total") as number]));
  const conConflicto = new Set(conflictos.docs.map((c) => c.get("teamId") as string));
  const orden = slots.docs.sort((a, b) => a.get("orden") - b.get("orden"));

  return (
    <Contenedor>
      <p className="mt-2 text-muted">
        {ronda === "final" ? "Final" : "Semifinal"} · {sala.get("nombre") ?? roomId}
      </p>
      {sala.get("cerrada") && (
        <p className="mt-4 rounded border border-accent bg-surface p-3 text-sm">La sala está cerrada: los puntajes quedaron bloqueados.</p>
      )}
      {orden.length === 0 ? (
        <p className="mt-6">La coordinación aún no publica el orden de presentación.</p>
      ) : (
        <ol className="mt-6 grid gap-3">
          {orden.map((s) => {
            const teamId = s.get("teamId") as string;
            const estado = conConflicto.has(teamId) ? "Conflicto declarado" : evaluados.has(teamId) ? `Evaluado: ${evaluados.get(teamId)}/100` : "Pendiente";
            return (
              <li key={s.id}>
                <Link href={`/jurado/${teamId}`} className="flex items-center gap-4 rounded border border-border bg-surface p-4 hover:border-navy-700">
                  <span className="w-12 shrink-0 text-center">
                    <span className="block text-xs text-muted">{s.get("orden")}.</span>
                    <span className="tabular-nums">{hora(s.get("horaProgramada"))}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{s.get("equipo")}</span>
                    <span className="text-sm text-muted">{s.get("track")}</span>
                  </span>
                  <span className={`shrink-0 text-sm font-medium ${estado === "Pendiente" ? "text-accent-text" : "text-positive-text"}`}>{estado}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Contenedor>
  );
}

function Contenedor({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Jurado</h1>
        <BotonSalir />
      </div>
      {children}
    </section>
  );
}
