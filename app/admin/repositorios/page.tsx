import type { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/session";
import { BotonAccion, FormularioAccion } from "@/components/admin/accion";
import { claseInput } from "@/components/formulario";
import { decidirA4, revalidarRepo } from "@/lib/admin/acciones";
import { fechaEnEcuador } from "@/lib/event/countdown";
import { adminDb } from "@/lib/firebase/admin";
import type { Alerta } from "@/lib/github";

export const metadata = { title: "Repositorios" };
export const dynamic = "force-dynamic";

const CP: Record<string, string> = { cumplido: "Cumplido", pendiente: "Pendiente", vencido: "Vencido" };

interface SnapshotAdmin {
  tomadoEn: Timestamp;
  checkpoint1: string;
  checkpoint2: string;
  alertas: Alerta[];
  commitsEnVentana: number;
}

export default async function Repositorios() {
  await requireAdmin("/admin/repositorios");
  const db = adminDb();
  const [equipos, repos, admis] = await Promise.all([db.collection("teams").get(), db.collection("repositories").get(), db.collection("admissibility").get()]);
  const repo = new Map(repos.docs.map((r) => [r.id, r]));
  const a4 = new Map(admis.docs.map((a) => [a.id, a.get("a4") as boolean | null | undefined]));
  const activos = equipos.docs.filter((e) => e.get("estado") !== "fusionado").sort((a, b) => String(a.get("nombre")).localeCompare(String(b.get("nombre"))));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Repositorios</h1>
      <p className="mt-1 text-sm text-muted">
        n8n toma snapshots cada 15 min (WF-04). «Revalidar ahora» consulta GitHub en el acto. A4 (corresponde al track) lo decide la mesa técnica.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3">Equipo</th>
              <th scope="col" className="py-2 pr-3">Repositorio</th>
              <th scope="col" className="py-2 pr-3">Checkpoints</th>
              <th scope="col" className="py-2 pr-3">Alertas</th>
              <th scope="col" className="py-2 pr-3">A4</th>
              <th scope="col" className="py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {activos.map((e) => {
              const r = repo.get(e.id);
              const s = r?.get("ultimoSnapshot") as SnapshotAdmin | undefined;
              const valorA4 = a4.get(e.id);
              return (
                <tr key={e.id} className="border-b border-border align-top">
                  <td className="py-2 pr-3 font-medium">
                    {e.get("nombre")} <span className="text-xs text-muted">{e.get("track")}</span>
                  </td>
                  <td className="py-2 pr-3">
                    {r ? (
                      <>
                        <a href={r.get("url")} className="break-all underline" target="_blank" rel="noopener noreferrer">
                          {r.get("name")}
                        </a>
                        <span className={`block text-xs font-medium ${r.get("validado") ? "text-positive-text" : "text-danger"}`}>
                          {r.get("validado") ? "Validado" : `No válido: ${((r.get("motivos") ?? []) as string[]).join(" ")}`}
                        </span>
                        {s && (
                          <span className="block text-xs text-muted">
                            Snapshot: {fechaEnEcuador(s.tomadoEn.toDate())} · {s.commitsEnVentana} commits
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-danger">Sin repositorio</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{s ? `1: ${CP[s.checkpoint1]} · 2: ${CP[s.checkpoint2]}` : "—"}</td>
                  <td className="py-2 pr-3">
                    {s?.alertas.length ? (
                      <ul className="grid gap-1">
                        {s.alertas.map((a, i) => (
                          <li key={i} className={a.nivel === "roja" ? "text-danger" : "text-accent-text"}>
                            {a.nivel === "roja" ? "Roja: " : "Ámbar: "}
                            {a.detalle}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">Ninguna</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <FormularioAccion accion={decidirA4.bind(null, e.id)} etiqueta="Guardar" className="flex items-center gap-2">
                      <label htmlFor={`a4-${e.id}`} className="sr-only">
                        A4 de {e.get("nombre")}
                      </label>
                      <select id={`a4-${e.id}`} name="a4" defaultValue={valorA4 === true ? "si" : valorA4 === false ? "no" : ""} className={`${claseInput} w-32 py-1`}>
                        <option value="">Pendiente</option>
                        <option value="si">Cumple</option>
                        <option value="no">No cumple</option>
                      </select>
                    </FormularioAccion>
                  </td>
                  <td className="py-2">{r && <BotonAccion accion={revalidarRepo.bind(null, e.id)}>Revalidar ahora</BotonAccion>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
