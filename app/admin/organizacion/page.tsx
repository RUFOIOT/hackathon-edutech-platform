import { MENTORIA_TEMAS } from "@/config/event";
import { requireAdmin } from "@/lib/auth/session";
import { BotonAccion, FormularioAccion } from "@/components/admin/accion";
import { CampoTexto } from "@/components/formulario";
import { guardarStaff, quitarStaff } from "@/lib/admin/acciones";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const metadata = { title: "Organización" };
export const dynamic = "force-dynamic";

const ROL: Record<string, { nombre: string; ve: string }> = {
  admin: { nombre: "Admin", ve: "Todo, con datos de contacto, privacidad y esta sección" },
  comite: { nombre: "Comité", ve: "Dashboard, participantes, equipos, jurado, resultados, comunicados, auditoría" },
  mesa_tecnica: { nombre: "Mesa técnica", ve: "Dashboard, participantes, equipos, repositorios, check-in, mentoría (sin contacto ni puntajes)" },
  checkin: { nombre: "Check-in", ve: "Solo la pantalla de check-in" },
  mentor: { nombre: "Mentor", ve: "Solo la cola de mentoría" },
};
const TEMA: Record<string, string> = { producto: "Producto", tecnica: "Técnica", n8n: "n8n", ia: "IA", pitch: "Pitch" };

/** Equipo organizador: quién entra al panel y con qué rol. Los jueces se gestionan en Jurado y salas. */
export default async function Organizacion() {
  const { uid: yo } = await requireAdmin("/admin/organizacion");
  const staff = (await adminDb().collection("staff").get()).docs;
  const usuarios = staff.length ? (await adminAuth().getUsers(staff.map((s) => ({ uid: s.id })))).users : [];
  const correo = new Map(usuarios.map((u) => [u.uid, u.email ?? ""]));
  const lista = staff.sort((a, b) => String(a.get("nombre")).localeCompare(String(b.get("nombre"))));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Organización</h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Da acceso al panel con el correo de cada persona: entra en /ingresar con ese correo y ve solo lo de su rol. Los jueces se registran
        en Jurado y salas.
      </p>

      <section aria-labelledby="agregar" className="mt-6 rounded border border-border bg-surface p-4">
        <h2 id="agregar" className="text-lg font-semibold">
          Agregar o cambiar roles
        </h2>
        <p className="mt-1 text-sm text-muted">Si el correo ya está en la lista, se reemplazan sus roles.</p>
        <div className="mt-3">
          <FormularioAccion accion={guardarStaff} etiqueta="Guardar acceso">
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoTexto id="staff-email" name="email" type="email" etiqueta="Correo" autoComplete="off" />
              <CampoTexto id="staff-nombre" name="nombre" etiqueta="Nombre" autoComplete="off" />
            </div>
            <fieldset className="grid gap-2">
              <legend className="font-medium">Roles</legend>
              {STAFF_ROLES.map((r) => (
                <label key={r} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="roles" value={r} className="mt-1 accent-navy-700" />
                  <span>
                    <strong>{ROL[r]?.nombre}</strong> · {ROL[r]?.ve}
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="font-medium">Temas que atiende (solo mentores; vacío = todos)</legend>
              <div className="flex flex-wrap gap-4">
                {MENTORIA_TEMAS.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="temas" value={t} className="accent-navy-700" /> {TEMA[t] ?? t}
                  </label>
                ))}
              </div>
            </fieldset>
          </FormularioAccion>
        </div>
      </section>

      <section aria-labelledby="equipo" className="mt-8">
        <h2 id="equipo" className="text-lg font-semibold">
          Equipo organizador ({lista.length})
        </h2>
        <ul className="mt-3 grid gap-2">
          {lista.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3">
              <span>
                <span className="block font-medium">
                  {s.get("nombre")}
                  {s.id === yo && <span className="ml-2 text-sm font-normal text-muted">(tú)</span>}
                </span>
                <span className="text-sm text-muted">
                  {correo.get(s.id) || "sin correo"} · {((s.get("roles") as string[]) ?? []).map((r) => ROL[r]?.nombre ?? r).join(", ")}
                  {(s.get("temas") as string[] | undefined)?.length ? ` · temas: ${(s.get("temas") as string[]).map((t) => TEMA[t] ?? t).join(", ")}` : ""}
                </span>
              </span>
              {s.id !== yo && (
                <BotonAccion accion={quitarStaff.bind(null, s.id)} confirmar="¿Quitar su acceso al panel?" etiquetaAccesible={`Quitar acceso a ${s.get("nombre")}`}>
                  Quitar acceso
                </BotonAccion>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
