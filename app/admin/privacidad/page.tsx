import { requireAdmin } from "@/lib/auth/session";
import { BotonAccion } from "@/components/admin/accion";
import { anonimizarSolicitud, aplicarPoliticaRetencion } from "@/lib/admin/acciones";
import { fechaEnEcuador } from "@/lib/event/countdown";
import { ahora } from "@/lib/event/reloj";
import { adminDb } from "@/lib/firebase/admin";
import { fechaRetencion, mesesRetencion, pendientesDeRetencion } from "@/lib/privacidad/retencion";

export const metadata = { title: "Privacidad" };
export const dynamic = "force-dynamic";

/** Solicitudes de eliminación (LOPDP) y política de retención. Solo admin. */
export default async function Privacidad() {
  await requireAdmin("/admin/privacidad");
  const db = adminDb();
  const solicitudes = (await db.collection("data_requests").where("estado", "==", "pendiente").get()).docs;
  const personas = solicitudes.length ? await db.getAll(...solicitudes.map((s) => db.doc(`participants/${s.get("participantId")}`))) : [];
  const vence = fechaRetencion();
  const vencida = ahora() >= vence;
  const pendientes = await pendientesDeRetencion();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Privacidad</h1>

      <section aria-labelledby="solicitudes" className="mt-6">
        <h2 id="solicitudes" className="text-lg font-semibold">
          Solicitudes de eliminación
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Hay 15 días para responder. Anonimizar borra la cuenta, los datos de contacto y la autorización del representante. Antes del kick-off
          la persona además sale de su equipo y libera su cupo.
        </p>
        <ul className="mt-4 grid gap-3">
          {solicitudes.map((s, i) => {
            const p = personas[i];
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-surface p-4">
                <span>
                  <span className="block font-medium">{p?.exists ? `${p.get("nombres")} ${p.get("apellidos")}` : s.get("participantId")}</span>
                  <span className="text-sm text-muted">{p?.get("email") ?? "Sin correo"}</span>
                </span>
                <BotonAccion
                  accion={anonimizarSolicitud.bind(null, s.get("participantId") as string)}
                  confirmar="¿Anonimizar? No se puede deshacer."
                  etiquetaAccesible={`Anonimizar a ${p?.get("nombres") ?? "la persona"}`}
                >
                  Anonimizar
                </BotonAccion>
              </li>
            );
          })}
          {solicitudes.length === 0 && <li className="text-muted">No hay solicitudes pendientes.</li>}
        </ul>
      </section>

      <section aria-labelledby="retencion" className="mt-10 border-t border-border pt-6">
        <h2 id="retencion" className="text-lg font-semibold">
          Política de retención
        </h2>
        <p className="mt-1 max-w-prose text-sm">
          Los datos personales se anonimizan {mesesRetencion()} meses después del evento: desde el <strong>{fechaEnEcuador(vence)}</strong>.
          Quedan las estadísticas (categoría, nivel, ciudad, perfil técnico, equipo) y la auditoría.
        </p>
        <p className="mt-2 text-sm">
          Personas sin anonimizar: <strong className="tabular-nums">{pendientes}</strong>
        </p>
        <div className="mt-4">
          {vencida ? (
            <BotonAccion accion={aplicarPoliticaRetencion} confirmar={`¿Anonimizar a ${pendientes} personas? No se puede deshacer.`} variante="primario">
              Aplicar la política de retención
            </BotonAccion>
          ) : (
            <p className="text-sm text-muted">El botón para aplicarla aparece cuando vence el plazo.</p>
          )}
        </div>
      </section>
    </div>
  );
}
