import { requireAdmin } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";

export const metadata = { title: "Dashboard 360" };

// Esqueleto de la Fase 1: conteos básicos para verificar el acceso por rol. Los bloques y KPIs son la Fase 6.
export default async function Admin() {
  const id = await requireAdmin("/admin");
  const [participantes, equipos] = await Promise.all([
    adminDb().collection("participants").count().get(),
    adminDb().collection("teams").count().get(),
  ]);
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Dashboard 360</h1>
      <p className="mt-1 text-sm text-muted">Roles: {id.staffRoles.join(", ")}</p>
      <dl className="mt-6 grid max-w-md grid-cols-2 gap-4">
        <div className="rounded border border-border bg-surface p-4">
          <dt className="text-sm text-muted">Inscritos</dt>
          <dd className="text-2xl font-semibold">{participantes.data().count}</dd>
        </div>
        <div className="rounded border border-border bg-surface p-4">
          <dt className="text-sm text-muted">Equipos</dt>
          <dd className="text-2xl font-semibold">{equipos.data().count}</dd>
        </div>
      </dl>
    </section>
  );
}
