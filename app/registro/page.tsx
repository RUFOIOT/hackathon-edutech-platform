import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EVENT, fecha } from "@/config/event";
import { FormIngreso } from "@/app/ingresar/form-ingreso";
import { getIdentidad } from "@/lib/auth/session";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { diaEnEcuador } from "@/lib/event/countdown";
import { faseActual, inscripcionesAbiertas, listaEsperaTardiaAbierta } from "@/lib/event/phase";
import { ahora } from "@/lib/event/reloj";
import { paseTardioDe, pasesTardios } from "@/lib/registro/pase-tardio";
import { buscarEquipoPorCodigo, cargarBorrador, invitacionPendiente } from "@/lib/registro/servicio";
import { CODIGO_INVITACION } from "@/lib/validation/registro";
import { Asistente } from "./asistente";

export const metadata: Metadata = { title: "Inscripción" };
export const dynamic = "force-dynamic";

export default async function Registro({ searchParams }: { searchParams: Promise<{ codigo?: string; pase?: string }> }) {
  const { codigo, pase: conPase } = await searchParams;
  const codigoValido = codigo && CODIGO_INVITACION.test(codigo.toUpperCase()) ? codigo.toUpperCase() : null;
  const t = ahora();

  const abiertas = inscripcionesAbiertas(t);
  // Inscripción tardía (D-50): solo a lista de espera, hasta cierreListaEspera.
  const tardia = !abiertas && listaEsperaTardiaAbierta(t);
  const id = await getIdentidad();
  // Con las inscripciones cerradas solo entra quien tiene un pase tardío (lib/registro/pase-tardio.ts).
  const pase = !abiertas && id && !id.esParticipante ? paseTardioDe((await adminAuth().getUser(id.uid)).email) : null;
  if (!abiertas && !pase && !id && conPase && pasesTardios().length > 0) {
    return (
      <Contenedor>
        <h1 className="text-3xl font-semibold">Inscripción con cupo habilitado</h1>
        <p className="mt-4 max-w-prose">
          Las inscripciones generales están cerradas, pero la organización te habilitó un cupo. Ingresa con el correo al que
          te llegó esta invitación: te enviamos un enlace y con él completas el formulario.
        </p>
        <div className="max-w-md">
          <FormIngreso siguiente="/registro?pase=1" />
        </div>
      </Contenedor>
    );
  }
  if (!abiertas && !pase && !tardia) {
    return (
      <Contenedor>
        <h1 className="text-3xl font-semibold">Inscripción</h1>
        <p className="mt-4">
          {id && conPase
            ? "Este correo no tiene un cupo habilitado. Ingresa con el correo al que te llegó la invitación."
            : faseActual(t) === "Convocatoria"
            ? `Las inscripciones abren el ${diaEnEcuador(fecha("aperturaInscripciones"))}${EVENT.fechas.aperturaInscripciones.confirmada ? "" : " (fecha por confirmar)"}.`
            : "Las inscripciones están cerradas."}
        </p>
        <Link href="/guia-hacker" className="mt-4 inline-block font-medium text-positive-text underline">
          Lee la Guía del hacker mientras tanto
        </Link>
      </Contenedor>
    );
  }

  if (!id) {
    const siguiente = codigoValido ? `/registro?codigo=${codigoValido}` : "/registro";
    return (
      <Contenedor>
        <h1 className="text-3xl font-semibold">Inscripción</h1>
        {tardia && !pase && (
        <p className="mt-4 max-w-prose rounded border border-accent bg-surface p-4">
          Las inscripciones ya cerraron. Si te inscribes ahora quedas en <strong>lista de espera</strong> como respaldo: si se
          libera un lugar, la organización te asigna a un equipo hasta las 16:30 de hoy y te avisa por correo.
        </p>
      )}
        <p className="mt-4 max-w-prose">
          Empieza verificando tu correo: te enviamos un enlace y con él continúas el formulario. Tu avance queda guardado en
          cada paso.
        </p>
        <div className="max-w-md">
          <FormIngreso siguiente={siguiente} />
        </div>
      </Contenedor>
    );
  }
  if (id.esParticipante) redirect("/mi-equipo");

  const user = await adminAuth().getUser(id.uid);
  const email = user.email ?? "";
  const [borrador, invitacion] = await Promise.all([cargarBorrador(id.uid), invitacionPendiente(email)]);
  let sugerido: { codigo: string; equipo: string | null } | null = invitacion;
  if (pase && !sugerido) {
    // El pase tardío ya dice a qué equipo se une: el código se completa solo.
    const eq = await adminDb().doc(`teams/${pase.teamId}`).get();
    if (eq.exists) sugerido = { codigo: String(eq.get("codigoInvitacion")), equipo: String(eq.get("nombre")) };
  }
  if (codigoValido && !sugerido) {
    const eq = await buscarEquipoPorCodigo(codigoValido);
    sugerido = { codigo: codigoValido, equipo: eq?.nombre ?? null };
  }

  return (
    <Contenedor>
      <h1 className="text-3xl font-semibold">Inscripción</h1>
      {tardia && !pase && (
        <p className="mt-4 max-w-prose rounded border border-accent bg-surface p-4">
          Las inscripciones ya cerraron. Si te inscribes ahora quedas en <strong>lista de espera</strong> como respaldo: si se
          libera un lugar, la organización te asigna a un equipo hasta las 16:30 de hoy y te avisa por correo.
        </p>
      )}
      <div className="mt-6">
        <Asistente inicial={borrador} email={email} codigoSugerido={sugerido} />
      </div>
    </Contenedor>
  );
}

function Contenedor({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-3xl px-4 py-12">{children}</section>;
}
