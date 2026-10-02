import type { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/session";
import { claseInput } from "@/components/formulario";
import { adminDb } from "@/lib/firebase/admin";

export const metadata = { title: "Auditoría" };
export const dynamic = "force-dynamic";

/** Registro de auditoría filtrable (solo admin y comité). Muestra los 300 registros más recientes. */
export default async function Auditoria({ searchParams }: { searchParams: Promise<{ entidad?: string; accion?: string; actor?: string }> }) {
  await requireAdmin("/admin/auditoria");
  const f = await searchParams;
  const base = adminDb().collection("audit_log");
  const q = (f.entidad ? base.where("entidad", "==", f.entidad) : base).orderBy("timestamp", "desc").limit(300);
  const docs = (await q.get()).docs.filter((d) => (!f.accion || String(d.get("accion")).includes(f.accion)) && (!f.actor || String(d.get("actor")).includes(f.actor)));
  const hora = (t?: Timestamp) =>
    t ? new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "medium" }).format(t.toDate()) : "—";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Auditoría</h1>
      <form className="mt-4 flex flex-wrap items-end gap-3 text-sm" role="search">
        <label className="grid gap-1">
          Entidad
          <input name="entidad" defaultValue={f.entidad} placeholder="scores, teams…" className={`${claseInput} py-1`} />
        </label>
        <label className="grid gap-1">
          Acción contiene
          <input name="accion" defaultValue={f.accion} placeholder="score, publish…" className={`${claseInput} py-1`} />
        </label>
        <label className="grid gap-1">
          Actor contiene
          <input name="actor" defaultValue={f.actor} className={`${claseInput} py-1`} />
        </label>
        <button type="submit" className="rounded bg-accent px-4 py-2 font-medium text-on-accent">
          Filtrar
        </button>
      </form>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3">Fecha</th>
              <th scope="col" className="py-2 pr-3">Actor</th>
              <th scope="col" className="py-2 pr-3">Acción</th>
              <th scope="col" className="py-2 pr-3">Entidad</th>
              <th scope="col" className="py-2">Cambio</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-border align-top">
                <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{hora(d.get("timestamp"))}</td>
                <td className="py-2 pr-3 font-mono text-xs">{d.get("actor")}</td>
                <td className="py-2 pr-3 font-mono text-xs">{d.get("accion")}</td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {d.get("entidad")}/{d.get("entidadId")}
                </td>
                <td className="break-all py-2 font-mono text-xs">
                  {d.get("antes") && <span className="text-muted">antes {JSON.stringify(d.get("antes"))} </span>}
                  {d.get("despues") && <span>después {JSON.stringify(d.get("despues"))}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
