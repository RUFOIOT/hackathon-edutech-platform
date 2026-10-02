import { requireAdmin } from "@/lib/auth/session";
import { TiempoReal } from "@/components/tiempo-real";
import { adminDb } from "@/lib/firebase/admin";
import { Checkin } from "./checkin";

export const metadata = { title: "Check-in" };
export const dynamic = "force-dynamic";

/** Check-in en celular: escáner de QR, búsqueda manual y conteo en vivo. */
export default async function PaginaCheckin() {
  await requireAdmin("/admin/checkin");
  const db = adminDb();
  const [participantes, checkins, equipos] = await Promise.all([
    db.collection("participants").where("enListaEspera", "==", false).get(),
    db.collection("checkins").get(),
    db.collection("teams").get(),
  ]);
  const presentes = new Set(checkins.docs.map((c) => c.get("participantId") as string));
  const equipo = new Map(equipos.docs.map((e) => [e.id, e.get("nombre") as string]));
  const personas = participantes.docs
    .map((p) => ({
      id: p.id,
      nombre: `${p.get("nombres")} ${p.get("apellidos")}`,
      equipo: p.get("teamId") ? (equipo.get(p.get("teamId")) ?? "") : "Sin equipo",
      categoria: p.get("categoria") as string,
      presente: presentes.has(p.id),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Check-in</h1>
      <p className="mt-2 text-lg">
        <strong className="tabular-nums">{personas.filter((p) => p.presente).length}</strong> de {personas.length} presentes
      </p>
      <TiempoReal colecciones={["checkins"]} intervaloMs={3000} />
      <p className="mt-1 text-sm text-muted">Categoría Open: pide el documento de identidad. Junior: verifica la autorización validada.</p>
      <div className="mt-6">
        <Checkin personas={personas} />
      </div>
    </div>
  );
}
