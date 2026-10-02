import { tieneRol } from "@/lib/auth/roles";
import { requireAdmin } from "@/lib/auth/session";
import { BotonAccion } from "@/components/admin/accion";
import { claseInput } from "@/components/formulario";
import { admitirDeListaEspera, decidirAutorizacion } from "@/lib/admin/acciones";
import { adminDb } from "@/lib/firebase/admin";

export const metadata = { title: "Participantes" };
export const dynamic = "force-dynamic";

type Filtros = { q?: string; categoria?: string; autorizacion?: string; equipo?: string; espera?: string };
const ESTADO_AUT: Record<string, string> = { pendiente: "pendiente", validado: "validada", rechazado: "rechazada" };

export default async function Participantes({ searchParams }: { searchParams: Promise<Filtros> }) {
  const id = await requireAdmin("/admin/participantes");
  const verRepresentantes = tieneRol(id, "admin", "comite");
  const verContacto = tieneRol(id, "admin");
  const f = await searchParams;
  const db = adminDb();
  const [participantes, guardianes, checkins, equipos] = await Promise.all([
    db.collection("participants").get(),
    verRepresentantes ? db.collection("guardians").get() : Promise.resolve(null),
    db.collection("checkins").get(),
    db.collection("teams").get(),
  ]);
  const guardian = new Map(guardianes?.docs.map((g) => [g.id, g]) ?? []);
  const presente = new Set(checkins.docs.map((c) => c.get("participantId") as string));
  const equipo = new Map(equipos.docs.map((e) => [e.id, e.get("nombre") as string]));
  const q = (f.q ?? "").trim().toLowerCase();

  const filas = participantes.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { id: string })
    .filter((p) => !q || `${p.nombres} ${p.apellidos} ${p.githubUsername} ${p.institucion}`.toLowerCase().includes(q))
    .filter((p) => !f.categoria || p.categoria === f.categoria)
    .filter((p) => !f.equipo || (f.equipo === "sin" ? !p.teamId : !!p.teamId))
    .filter((p) => f.espera !== "si" || p.enListaEspera === true)
    .filter((p) => !f.autorizacion || (p.categoria === "JUNIOR" && (guardian.get(p.id)?.get("estado") ?? "pendiente") === f.autorizacion))
    .sort((a, b) => String(a.apellidos).localeCompare(String(b.apellidos)));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Participantes</h1>
        <a href="/api/admin/exportar?formato=csv" className="rounded border border-border bg-surface px-3 py-2 text-sm font-medium">
          Exportar CSV {verContacto ? "(con contacto)" : "(sin datos de contacto)"}
        </a>
      </div>
      <form className="mt-4 flex flex-wrap items-end gap-3 text-sm" role="search">
        <label className="grid gap-1">
          Buscar
          <input name="q" defaultValue={f.q} placeholder="Nombre, GitHub o institución" className={`${claseInput} py-1`} />
        </label>
        <label className="grid gap-1">
          Categoría
          <select name="categoria" defaultValue={f.categoria ?? ""} className={`${claseInput} py-1`}>
            <option value="">Todas</option>
            <option value="JUNIOR">Junior</option>
            <option value="OPEN">Open</option>
          </select>
        </label>
        {verRepresentantes && (
          <label className="grid gap-1">
            Autorización Junior
            <select name="autorizacion" defaultValue={f.autorizacion ?? ""} className={`${claseInput} py-1`}>
              <option value="">Cualquiera</option>
              <option value="pendiente">Pendiente</option>
              <option value="validado">Validada</option>
              <option value="rechazado">Rechazada</option>
            </select>
          </label>
        )}
        <label className="grid gap-1">
          Equipo
          <select name="equipo" defaultValue={f.equipo ?? ""} className={`${claseInput} py-1`}>
            <option value="">Todos</option>
            <option value="sin">Sin equipo</option>
            <option value="con">Con equipo</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="espera" value="si" defaultChecked={f.espera === "si"} className="accent-navy-700" /> Solo lista de espera
        </label>
        <button type="submit" className="rounded bg-accent px-4 py-2 font-medium text-on-accent">
          Filtrar
        </button>
      </form>
      <p className="mt-3 text-sm text-muted">{filas.length} personas</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3">Nombre</th>
              {verContacto && <th scope="col" className="py-2 pr-3">Contacto</th>}
              <th scope="col" className="py-2 pr-3">Categoría</th>
              <th scope="col" className="py-2 pr-3">Equipo</th>
              <th scope="col" className="py-2 pr-3">GitHub</th>
              <th scope="col" className="py-2 pr-3">Check-in</th>
              <th scope="col" className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p) => {
              const g = guardian.get(p.id);
              const estadoG = g?.get("estado") as string | undefined;
              return (
                <tr key={p.id} className="border-b border-border align-top">
                  <td className="py-2 pr-3">
                    {String(p.nombres)} {String(p.apellidos)}
                    <span className="block text-xs text-muted">{String(p.institucion)}</span>
                  </td>
                  {verContacto && (
                    <td className="py-2 pr-3 text-xs">
                      {String(p.email)}
                      <br />
                      {String(p.celular)}
                    </td>
                  )}
                  <td className="py-2 pr-3">{p.categoria === "JUNIOR" ? "Junior" : "Open"}</td>
                  <td className="py-2 pr-3">{p.teamId ? equipo.get(String(p.teamId)) : <span className="text-muted">Sin equipo</span>}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{String(p.githubUsername)}</td>
                  <td className="py-2 pr-3">{presente.has(p.id) ? "Presente" : "—"}</td>
                  <td className="py-2">
                    <div className="grid gap-1">
                      {p.enListaEspera === true && (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-accent-text">Lista de espera</span>
                          <BotonAccion accion={admitirDeListaEspera.bind(null, p.id)}>Admitir</BotonAccion>
                        </span>
                      )}
                      {p.categoria === "JUNIOR" && verRepresentantes && (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={estadoG === "validado" ? "text-positive-text" : estadoG === "rechazado" ? "text-danger" : "text-accent-text"}>
                            Autorización: {estadoG ? ESTADO_AUT[estadoG] : "sin cargar"}
                          </span>
                          {g?.get("archivoPath") && (
                            <a href={`/api/admin/autorizacion/${p.id}`} className="underline" target="_blank" rel="noopener">
                              Ver PDF
                            </a>
                          )}
                          {g && estadoG !== "validado" && <BotonAccion accion={decidirAutorizacion.bind(null, p.id, "validado")}>Validar</BotonAccion>}
                          {g && estadoG !== "rechazado" && (
                            <BotonAccion accion={decidirAutorizacion.bind(null, p.id, "rechazado")} confirmar="¿Rechazar la autorización?">
                              Rechazar
                            </BotonAccion>
                          )}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
