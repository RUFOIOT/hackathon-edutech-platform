import Link from "next/link";
import { redirect } from "next/navigation";
import type { Timestamp } from "firebase-admin/firestore";
import { fecha } from "@/config/event";
import { requireSesion } from "@/lib/auth/session";
import { entregaAbierta, rutaPitch } from "@/lib/entrega/servicio";
import { fechaEnEcuador } from "@/lib/event/countdown";
import { ahora } from "@/lib/event/reloj";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { FormEntrega } from "./formulario";

export const metadata = { title: "Entregar proyecto" };
export const dynamic = "force-dynamic";

export default async function Entrega() {
  const id = await requireSesion("/mi-equipo/entrega");
  if (!id.esParticipante) redirect("/registro");
  const p = await adminDb().doc(`participants/${id.uid}`).get();
  const teamId = p.get("teamId") as string | null;
  if (!teamId) redirect("/mi-equipo");
  const [repo, sub, [pitchExiste]] = await Promise.all([
    adminDb().doc(`repositories/${teamId}`).get(),
    adminDb().doc(`submissions/${teamId}`).get(),
    adminStorage().bucket().file(rutaPitch(teamId)).exists(),
  ]);
  const t = ahora();
  const abierta = entregaAbierta(t);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Entregar proyecto</h1>
      <p className="mt-2 text-muted">Cierra a las 12:00 del sábado (code freeze). Puedes volver a entregar hasta esa hora; vale la última.</p>

      <ol className="mt-6 list-decimal space-y-1 pl-5 text-sm">
        <li>
          Crea el tag y súbelo: <code className="font-mono">git tag entrega &amp;&amp; git push origin main --tags</code>
        </li>
        <li>Confirma la URL del repositorio, la demo y sube el PDF del pitch.</li>
        <li>Marca las tres declaraciones y pulsa Entregar proyecto.</li>
      </ol>

      {sub.exists && sub.get("tagSha") && (
        <section aria-labelledby="ultima" className="mt-8 rounded border border-border bg-surface p-4">
          <h2 id="ultima" className="font-semibold">
            Última entrega
          </h2>
          <p className="mt-1 text-sm">
            Commit evaluado: <span className="break-all font-mono">{sub.get("tagSha")}</span>
          </p>
          {sub.get("enviadoAt") && <p className="text-sm text-muted">Enviada el {fechaEnEcuador((sub.get("enviadoAt") as Timestamp).toDate())}</p>}
          {sub.get("tagMovidoTrasFreeze") && (
            <p className="mt-2 text-sm font-medium text-danger">El tag entrega se movió después del code freeze. El comité revisará el caso.</p>
          )}
        </section>
      )}

      <div className="mt-8">
        {!abierta ? (
          <p className="rounded border border-accent bg-surface p-4">
            {t < fecha("kickoff")
              ? `La entrega se habilita desde el kick-off: ${fechaEnEcuador(fecha("kickoff"))}.`
              : "El formulario de entrega cerró a las 12:00 del sábado (code freeze)."}
          </p>
        ) : !repo.exists || !repo.get("validado") ? (
          <p className="rounded border border-accent bg-surface p-4">
            Primero registra un repositorio válido en{" "}
            <Link href="/mi-equipo/repositorio" className="font-medium underline">
              Repositorio
            </Link>
            .
          </p>
        ) : (
          <FormEntrega repoUrl={repo.get("url")} demoPrevia={sub.get("demoUrl") ?? null} pitchSubido={pitchExiste} />
        )}
      </div>
    </div>
  );
}
