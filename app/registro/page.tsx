import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EVENT, fecha } from "@/config/event";
import { FormIngreso } from "@/app/ingresar/form-ingreso";
import { getIdentidad } from "@/lib/auth/session";
import { adminAuth } from "@/lib/firebase/admin";
import { diaEnEcuador } from "@/lib/event/countdown";
import { faseActual, inscripcionesAbiertas } from "@/lib/event/phase";
import { ahora } from "@/lib/event/reloj";
import { buscarEquipoPorCodigo, cargarBorrador, invitacionPendiente } from "@/lib/registro/servicio";
import { CODIGO_INVITACION } from "@/lib/validation/registro";
import { Asistente } from "./asistente";

export const metadata: Metadata = { title: "Inscripción" };
export const dynamic = "force-dynamic";

export default async function Registro({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo } = await searchParams;
  const codigoValido = codigo && CODIGO_INVITACION.test(codigo.toUpperCase()) ? codigo.toUpperCase() : null;
  const t = ahora();

  if (!inscripcionesAbiertas(t)) {
    return (
      <Contenedor>
        <h1 className="text-3xl font-semibold">Inscripción</h1>
        <p className="mt-4">
          {faseActual(t) === "Convocatoria"
            ? `Las inscripciones abren el ${diaEnEcuador(fecha("aperturaInscripciones"))}${EVENT.fechas.aperturaInscripciones.confirmada ? "" : " (fecha por confirmar)"}.`
            : "Las inscripciones están cerradas."}
        </p>
        <Link href="/guia-hacker" className="mt-4 inline-block font-medium text-positive-text underline">
          Lee la Guía del hacker mientras tanto
        </Link>
      </Contenedor>
    );
  }

  const id = await getIdentidad();
  if (!id) {
    const siguiente = codigoValido ? `/registro?codigo=${codigoValido}` : "/registro";
    return (
      <Contenedor>
        <h1 className="text-3xl font-semibold">Inscripción</h1>
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
  if (codigoValido && !sugerido) {
    const eq = await buscarEquipoPorCodigo(codigoValido);
    sugerido = { codigo: codigoValido, equipo: eq?.nombre ?? null };
  }

  return (
    <Contenedor>
      <h1 className="text-3xl font-semibold">Inscripción</h1>
      <div className="mt-6">
        <Asistente inicial={borrador} email={email} codigoSugerido={sugerido} />
      </div>
    </Contenedor>
  );
}

function Contenedor({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-3xl px-4 py-12">{children}</section>;
}
