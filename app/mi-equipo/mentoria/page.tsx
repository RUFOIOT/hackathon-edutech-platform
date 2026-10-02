import { redirect } from "next/navigation";
import { MENTORIA_TEMAS } from "@/config/event";
import { requireSesion } from "@/lib/auth/session";
import { FormularioAccion } from "@/components/admin/accion";
import { CampoArea, CampoSelect } from "@/components/formulario";
import { pedirMentoria } from "@/lib/admin/acciones";
import { adminDb } from "@/lib/firebase/admin";

export const metadata = { title: "Pedir mentor" };
export const dynamic = "force-dynamic";

const TEMA: Record<string, string> = { producto: "Producto", tecnica: "Técnica", n8n: "n8n", ia: "IA", pitch: "Pitch" };
const ESTADO: Record<string, string> = { abierta: "Esperando mentor", atendida: "En atención", cerrada: "Cerrada" };

/** Guía del Hacker §9: los mentores ayudan a pensar, no escriben el código. */
export default async function PedirMentor() {
  const id = await requireSesion("/mi-equipo/mentoria");
  if (!id.esParticipante) redirect("/registro");
  const p = await adminDb().doc(`participants/${id.uid}`).get();
  const teamId = p.get("teamId") as string | null;
  if (!teamId) redirect("/mi-equipo");
  const solicitudes = (await adminDb().collection("mentor_requests").where("teamId", "==", teamId).get()).docs.sort(
    (a, b) => (b.get("abiertaAt")?.toMillis() ?? 0) - (a.get("abiertaAt")?.toMillis() ?? 0),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Pedir mentor</h1>
      <p className="mt-2 max-w-prose text-muted">
        Los mentores te ayudan a pensar, no escriben tu código. Hay dos rondas fijas y mentoría a demanda mientras la sede esté abierta.
      </p>
      <div className="mt-6 rounded border border-border bg-surface p-4">
        <FormularioAccion accion={pedirMentoria} etiqueta="Pedir mentor">
          <CampoSelect id="tema" name="tema" etiqueta="Tema" opciones={MENTORIA_TEMAS.map((t) => ({ valor: t, etiqueta: TEMA[t] ?? t }))} />
          <CampoArea id="detalle" name="detalle" etiqueta="¿En qué necesitan ayuda?" opcional maxLength={300} />
        </FormularioAccion>
      </div>
      <h2 className="mt-10 text-xl font-semibold">Solicitudes del equipo</h2>
      <ul className="mt-3 grid gap-2">
        {solicitudes.map((s) => (
          <li key={s.id} className="flex justify-between gap-3 rounded border border-border p-3 text-sm">
            <span>{TEMA[s.get("tema")] ?? s.get("tema")}</span>
            <span className="font-medium">{ESTADO[s.get("estado")] ?? s.get("estado")}</span>
          </li>
        ))}
        {solicitudes.length === 0 && <li className="text-muted">Aún no han pedido mentoría.</li>}
      </ul>
    </div>
  );
}
