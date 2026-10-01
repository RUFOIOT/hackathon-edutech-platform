import { redirect } from "next/navigation";
import { TRACKS, fecha, type TrackCode } from "@/config/event";
import { requireSesion } from "@/lib/auth/session";
import { qrCheckinSvg } from "@/lib/checkin/qr-svg";
import { NOMBRE_ROL } from "@/lib/content/perfil";
import { ahora } from "@/lib/event/reloj";
import { adminDb } from "@/lib/firebase/admin";
import type { RolEquipo } from "@/config/event";
import { BotonSalir } from "@/components/boton-salir";
import { BotonEliminacion, CambioTrack, FormInvitar, FormUnirme, SelectorRol } from "./controles";

export const metadata = { title: "Mi equipo" };
export const dynamic = "force-dynamic";

const ESTADO_AUTORIZACION: Record<string, string> = {
  pendiente: "Pendiente de validación por la organización",
  validado: "Validada",
  rechazado: "Rechazada: revisa tu correo para saber cómo corregirla",
};

export default async function MiEquipo({ searchParams }: { searchParams: Promise<{ inscrito?: string }> }) {
  const id = await requireSesion("/mi-equipo");
  if (!id.esParticipante) redirect("/registro");
  const { inscrito } = await searchParams;
  const db = adminDb();

  const p = await db.doc(`participants/${id.uid}`).get();
  const teamId = p.get("teamId") as string | null;
  const [equipo, miembros, invitaciones, guardian, qr] = await Promise.all([
    teamId ? db.doc(`teams/${teamId}`).get() : null,
    teamId ? db.collection("team_members").where("teamId", "==", teamId).get() : null,
    teamId ? db.collection("invitations").where("teamId", "==", teamId).where("estado", "==", "pendiente").get() : null,
    p.get("categoria") === "JUNIOR" ? db.doc(`guardians/${id.uid}`).get() : null,
    qrCheckinSvg(id.uid),
  ]);
  const esCapitan = equipo?.get("capitanId") === id.uid;
  const track = equipo?.get("track") as TrackCode | undefined;
  const puedeCambiarTrack = esCapitan && ahora() < fecha("checkpoint1");
  const listaEspera = p.get("enListaEspera") === true;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold">Mi equipo</h1>
        <BotonSalir />
      </div>

      {inscrito && (
        <p role="status" className="mt-6 rounded border-2 border-positive bg-surface p-4 font-medium">
          {listaEspera
            ? "Inscripción recibida. Estás en lista de espera: te avisaremos por correo si se libera un cupo."
            : equipo?.get("capitanId") === id.uid
              ? "Equipo inscrito. Enviamos las invitaciones a tus compañeros."
              : "Inscripción confirmada. Te enviamos un correo con los próximos pasos."}
        </p>
      )}

      {listaEspera && !inscrito && (
        <p className="mt-6 rounded border border-accent bg-surface p-4">Estás en lista de espera. Te avisaremos por correo si se libera un cupo.</p>
      )}

      {equipo?.exists ? (
        <section aria-labelledby="equipo" className="mt-8">
          <h2 id="equipo" className="text-2xl font-semibold">
            {equipo.get("nombre")}
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted">Track</dt>
              <dd className="font-medium">{track ? `${track} · ${TRACKS[track].nombre}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Estado</dt>
              <dd className="font-medium">
                {equipo.get("estado") === "completo"
                  ? `Completo (${equipo.get("miembros")} integrantes)`
                  : `Incompleto: ${equipo.get("miembros")} de mínimo 2 integrantes`}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Código de invitación</dt>
              <dd className="font-mono text-lg tracking-widest">{equipo.get("codigoInvitacion")}</dd>
            </div>
          </dl>
          {equipo.get("requiereAdulto") && !equipo.get("adultoResponsableId") && (
            <p className="mt-4 rounded border border-accent bg-surface p-3 text-sm">
              Tu equipo tiene integrantes Junior: la organización le asignará un mentor adulto responsable antes del evento.
            </p>
          )}

          <h3 className="mt-8 text-lg font-semibold">Integrantes</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-4">Nombre</th>
                  <th scope="col" className="py-2 pr-4">GitHub</th>
                  <th scope="col" className="py-2">Rol</th>
                </tr>
              </thead>
              <tbody>
                {miembros?.docs.map((m) => (
                  <tr key={m.id} className="border-b border-border align-top">
                    <td className="py-2 pr-4">
                      {m.get("nombre")}
                      {m.get("esCapitan") && <span className="ml-2 text-xs text-muted">(capitán)</span>}
                      {m.get("participantId") === id.uid && <span className="ml-2 text-xs text-muted">(tú)</span>}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{m.get("githubUsername")}</td>
                    <td className="py-2">
                      {m.get("participantId") === id.uid ? <SelectorRol actual={m.get("rol")} /> : NOMBRE_ROL[m.get("rol") as RolEquipo]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invitaciones && invitaciones.size > 0 && (
            <>
              <h3 className="mt-8 text-lg font-semibold">Invitaciones pendientes</h3>
              <ul className="mt-2 grid gap-1 text-sm">
                {invitaciones.docs.map((i) => (
                  <li key={i.id}>{i.get("email")}</li>
                ))}
              </ul>
            </>
          )}

          {esCapitan && (
            <div className="mt-8 grid gap-6 rounded border border-border bg-surface p-4">
              <FormInvitar />
              {puedeCambiarTrack && track && <CambioTrack actual={track} />}
            </div>
          )}
        </section>
      ) : (
        !listaEspera && (
          <section aria-labelledby="sin-equipo" className="mt-8 rounded border border-border bg-surface p-4">
            <h2 id="sin-equipo" className="text-xl font-semibold">
              Estás en el matchmaking
            </h2>
            <p className="mt-2 text-sm">La organización forma los equipos el viernes a las 15:15. Si alguien te comparte un código, puedes unirte ahora.</p>
            <div className="mt-4">
              <FormUnirme />
            </div>
          </section>
        )
      )}

      {guardian && (
        <section aria-labelledby="autorizacion" className="mt-8">
          <h2 id="autorizacion" className="text-xl font-semibold">
            Autorización del representante
          </h2>
          <p className="mt-2">{guardian.exists ? ESTADO_AUTORIZACION[guardian.get("estado") as string] : "No encontramos tu autorización: escribe a la mesa técnica."}</p>
        </section>
      )}

      <section aria-labelledby="qr" className="mt-8 grid gap-4 sm:grid-cols-[12rem_1fr] sm:items-center">
        <div className="w-48 rounded border border-border bg-white p-2" role="img" aria-label="Tu código QR de check-in" dangerouslySetInnerHTML={{ __html: qr }} />
        <div>
          <h2 id="qr" className="text-xl font-semibold">
            Tu QR de check-in
          </h2>
          <p className="mt-2 text-sm">Muéstralo en la entrada el viernes desde las 13:30. Es personal: no lo compartas.</p>
          {p.get("categoria") === "OPEN" && <p className="mt-1 text-sm text-muted">Lleva también tu documento de identidad.</p>}
        </div>
      </section>

      <section aria-labelledby="datos" className="mt-10 border-t border-border pt-6">
        <h2 id="datos" className="text-xl font-semibold">
          Mis datos
        </h2>
        <p className="mt-2 max-w-prose text-sm">
          Conforme a la LOPDP puedes acceder a tus datos y pedir su eliminación. Para corregir un dato, escribe a la mesa técnica.
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-4">
          <a href="/api/mis-datos" className="rounded border border-border bg-surface px-3 py-2 text-sm font-medium">
            Descargar mis datos
          </a>
          <BotonEliminacion />
        </div>
      </section>
    </div>
  );
}
