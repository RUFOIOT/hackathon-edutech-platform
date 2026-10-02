import type { Timestamp } from "firebase-admin/firestore";
import { TRACK_CODES } from "@/config/event";
import { requireAdmin } from "@/lib/auth/session";
import { FormularioAccion } from "@/components/admin/accion";
import { CampoArea, CampoSelect } from "@/components/formulario";
import { enviarComunicado } from "@/lib/admin/acciones";
import { fechaEnEcuador } from "@/lib/event/countdown";
import { adminDb } from "@/lib/firebase/admin";

export const metadata = { title: "Comunicados" };
export const dynamic = "force-dynamic";

export default async function Comunicados() {
  await requireAdmin("/admin/comunicados");
  const db = adminDb();
  const [lista, equipos] = await Promise.all([db.collection("announcements").orderBy("enviadoAt", "desc").limit(50).get(), db.collection("teams").get()]);
  const nombre = new Map(equipos.docs.map((e) => [e.id, e.get("nombre") as string]));
  const alcanceTexto = (a: { tipo: string; track?: string; teamId?: string }) =>
    a.tipo === "todos" ? "Todos" : a.tipo === "track" ? `Track ${a.track}` : `Equipo ${nombre.get(a.teamId ?? "") ?? a.teamId}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Comunicados</h1>
      <p className="mt-1 text-sm text-muted">Se envían por correo y Slack a través de n8n (WF-08).</p>
      <div className="mt-6 rounded border border-border bg-surface p-4">
        <FormularioAccion accion={enviarComunicado} etiqueta="Enviar comunicado">
          <div className="grid gap-3 sm:grid-cols-3">
            <CampoSelect
              id="tipo"
              name="tipo"
              etiqueta="Alcance"
              opciones={[
                { valor: "todos", etiqueta: "Todos los inscritos" },
                { valor: "track", etiqueta: "Un track" },
                { valor: "equipo", etiqueta: "Un equipo" },
              ]}
            />
            <CampoSelect id="track" name="track" etiqueta="Track" opcional opciones={TRACK_CODES.map((t) => ({ valor: t, etiqueta: t }))} />
            <CampoSelect id="teamId" name="teamId" etiqueta="Equipo" opcional opciones={equipos.docs.map((e) => ({ valor: e.id, etiqueta: e.get("nombre") }))} />
          </div>
          <CampoArea id="mensaje" name="mensaje" etiqueta="Mensaje" maxLength={1000} />
        </FormularioAccion>
      </div>
      <h2 className="mt-10 text-xl font-semibold">Enviados</h2>
      <ul className="mt-3 grid gap-3">
        {lista.docs.map((c) => (
          <li key={c.id} className="rounded border border-border p-3">
            <p className="text-sm text-muted">
              {c.get("enviadoAt") ? fechaEnEcuador((c.get("enviadoAt") as Timestamp).toDate()) : "—"} · {alcanceTexto(c.get("alcance"))} · {c.get("destinatarios")}{" "}
              personas
            </p>
            <p className="mt-1">{c.get("mensaje")}</p>
          </li>
        ))}
        {lista.empty && <li className="text-muted">Aún no hay comunicados.</li>}
      </ul>
    </div>
  );
}
