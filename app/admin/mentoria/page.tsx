import type { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/session";
import { BotonAccion } from "@/components/admin/accion";
import { TiempoReal } from "@/components/tiempo-real";
import { cambiarEstadoMentoria } from "@/lib/admin/acciones";
import { ahora } from "@/lib/event/reloj";
import { adminDb } from "@/lib/firebase/admin";

export const metadata = { title: "Mentoría" };
export const dynamic = "force-dynamic";

/** Cola de mentoría: el mentor toma una solicitud y la cierra al terminar. */
export default async function Mentoria() {
  await requireAdmin("/admin/mentoria");
  const db = adminDb();
  const [solicitudes, equipos] = await Promise.all([db.collection("mentor_requests").where("estado", "in", ["abierta", "atendida"]).get(), db.collection("teams").get()]);
  const nombre = new Map(equipos.docs.map((e) => [e.id, e.get("nombre") as string]));
  const t = ahora().getTime();
  const ms = (x: unknown) => (x as Timestamp | undefined)?.toMillis?.() ?? t;
  const lista = solicitudes.docs.sort((a, b) => ms(a.get("abiertaAt")) - ms(b.get("abiertaAt")));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Mentoría</h1>
      <TiempoReal colecciones={["mentor_requests"]} intervaloMs={4000} />
      <ul className="mt-6 grid gap-3">
        {lista.map((m) => {
          const espera = Math.round((t - ms(m.get("abiertaAt"))) / 60_000);
          const atrasada = m.get("estado") === "abierta" && espera > 30;
          return (
            <li key={m.id} className={`rounded border bg-surface p-4 ${atrasada ? "border-danger" : "border-border"}`}>
              <p className="font-semibold">
                {nombre.get(m.get("teamId")) ?? m.get("teamId")} · {m.get("tema")}
              </p>
              {m.get("detalle") && <p className="mt-1 text-sm">{m.get("detalle")}</p>}
              <p className={`mt-1 text-sm ${atrasada ? "font-medium text-danger" : "text-muted"}`}>
                {m.get("estado") === "abierta" ? `Esperando hace ${espera} min${atrasada ? " (más de 30: escalada)" : ""}` : "En atención"}
              </p>
              <div className="mt-2 flex gap-2">
                {m.get("estado") === "abierta" && <BotonAccion accion={cambiarEstadoMentoria.bind(null, m.id, "atendida")}>Tomar solicitud</BotonAccion>}
                <BotonAccion accion={cambiarEstadoMentoria.bind(null, m.id, "cerrada")}>Cerrar</BotonAccion>
              </div>
            </li>
          );
        })}
        {lista.length === 0 && <li className="text-muted">No hay solicitudes abiertas.</li>}
      </ul>
    </div>
  );
}
