import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { fecha } from "@/config/event";
import { auditarEn } from "@/lib/audit";
import { despachar, encolarEn } from "@/lib/eventos";
import { ahora } from "@/lib/event/reloj";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { calcularAdmisibilidad, resolveDeliveryTag, type Chequeo } from "@/lib/github";
import { clienteGithub } from "@/lib/github/cliente";
import { tomarSnapshot } from "@/lib/github/servicio";
import { ErrorRegistro } from "@/lib/registro/servicio";
import { PITCH_MAX_BYTES, type Entrega } from "@/lib/validation/entrega";

const db = () => adminDb();
export const rutaPitch = (teamId: string) => `pitches/${teamId}.pdf`;

/** La entrega está abierta desde el kick-off hasta el code freeze. */
export function entregaAbierta(t: Date = ahora()): boolean {
  return t >= fecha("kickoff") && t < fecha("codeFreeze");
}

/**
 * Prepara la subida del PDF del pitch (hasta 20 MB). En producción devuelve una URL firmada
 * de subida directa a Storage, válida 10 minutos y limitada a 20 MB por cabecera, porque el
 * archivo no cabe en una función de Netlify (D-17). Con emuladores, la subida pasa por el
 * servidor (el emulador no firma URLs; D-25).
 */
export async function prepararSubidaPitch(
  teamId: string,
): Promise<{ modo: "firmada"; url: string; cabeceras: Record<string, string> } | { modo: "servidor" }> {
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) return { modo: "servidor" };
  const rango = `0,${PITCH_MAX_BYTES}`;
  const [url] = await adminStorage()
    .bucket()
    .file(rutaPitch(teamId))
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 10 * 60_000,
      contentType: "application/pdf",
      extensionHeaders: { "x-goog-content-length-range": rango },
    });
  return { modo: "firmada", url, cabeceras: { "Content-Type": "application/pdf", "x-goog-content-length-range": rango } };
}

/** Subida por el servidor: solo con emuladores (D-25). */
export async function subirPitchPorServidor(teamId: string, bytes: Uint8Array): Promise<void> {
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new ErrorRegistro("La subida del pitch debe hacerse con el enlace firmado.");
  await adminStorage().bucket().file(rutaPitch(teamId)).save(Buffer.from(bytes), { contentType: "application/pdf", resumable: false });
}

/** Comprueba que el pitch subido exista, pese ≤ 20 MB y sea un PDF real (cabecera %PDF-). */
async function verificarPitch(teamId: string): Promise<void> {
  const archivo = adminStorage().bucket().file(rutaPitch(teamId));
  const [existe] = await archivo.exists();
  if (!existe) throw new ErrorRegistro("Sube el PDF del pitch antes de entregar.", "pitch");
  const [meta] = await archivo.getMetadata();
  if (Number(meta.size ?? 0) > PITCH_MAX_BYTES) throw new ErrorRegistro("El PDF del pitch pesa más de 20 MB.", "pitch");
  const [inicio] = await archivo.download({ start: 0, end: 4 });
  if (inicio.toString("utf8") !== "%PDF-") throw new ErrorRegistro("El archivo del pitch no es un PDF válido.", "pitch");
}

export interface ResultadoEntrega {
  tagSha: string;
  tagCommitAt: Date;
}

export async function enviarEntrega(uid: string, teamId: string, datos: Entrega): Promise<ResultadoEntrega> {
  if (!entregaAbierta()) throw new ErrorRegistro("El formulario de entrega cerró a las 12:00 del sábado (code freeze).");
  const [team, repo] = await Promise.all([db().doc(`teams/${teamId}`).get(), db().doc(`repositories/${teamId}`).get()]);
  if (!repo.exists || !repo.get("validado")) {
    throw new ErrorRegistro("Primero registra un repositorio válido en la pestaña Repositorio.", "repo");
  }
  await verificarPitch(teamId);

  const tag = await resolveDeliveryTag({ owner: repo.get("owner"), name: repo.get("name") }, clienteGithub);
  if (!tag.existe || !tag.sha || !tag.commitAt) {
    throw new ErrorRegistro(
      "No encontramos el tag entrega en tu repositorio. Créalo y súbelo: git tag entrega && git push origin main --tags",
      "tag",
    );
  }

  // Snapshot final para A3 (archivos obligatorios). Si GitHub falla, se usa el último guardado.
  const snapshot = await tomarSnapshot(teamId).catch(() => null);
  const archivos = (snapshot?.archivosObligatorios ?? repo.get("ultimoSnapshot.archivosObligatorios") ?? null) as Record<string, boolean> | null;
  const previa = await db().doc(`admissibility/${teamId}`).get();
  const admisibilidad = calcularAdmisibilidad({
    validacion: { chequeos: (repo.get("chequeos") ?? []) as Chequeo[] },
    tag,
    tagMovidoTrasFreeze: false,
    archivos,
    a4: previa.exists ? (previa.get("a4") ?? null) : null,
    declaracionDatosSinteticos: datos.datosSinteticos,
  });

  const miembros = await db().collection("team_members").where("teamId", "==", teamId).get();
  const participantes = miembros.empty ? [] : await db().getAll(...miembros.docs.map((m) => db().doc(`participants/${m.get("participantId")}`)));
  const destinatarios = participantes.map((p) => p.get("email") as string).filter(Boolean);

  const subRef = db().doc(`submissions/${teamId}`);
  const antes = await subRef.get();
  const batch = db().batch();
  const demoUrl = datos.modoDemo === "url" ? datos.demoUrl! : "ejecucion-local";
  batch.set(
    subRef,
    {
      teamId,
      repoUrl: repo.get("url"),
      demoUrl,
      pitchPath: rutaPitch(teamId),
      videoUrl: datos.videoUrl || null,
      declaraciones: { datosSinteticos: datos.datosSinteticos, priorWork: datos.priorWork, aiUsage: datos.aiUsage },
      tagSha: tag.sha,
      tagCommitAt: Timestamp.fromDate(tag.commitAt),
      enviadoAt: FieldValue.serverTimestamp(),
      enviadoPor: uid,
      envios: FieldValue.increment(1),
    },
    { merge: true },
  );
  batch.set(db().doc(`admissibility/${teamId}`), { teamId, ...admisibilidad, calculadoAt: FieldValue.serverTimestamp(), origen: "entrega" }, { merge: true });
  auditarEn(batch, {
    actor: uid,
    accion: antes.exists ? "submission.update" : "submission.create",
    entidad: "submissions",
    entidadId: teamId,
    antes: antes.exists ? { tagSha: antes.get("tagSha") ?? null } : null,
    despues: { tagSha: tag.sha, demo: demoUrl },
  });
  const evento = encolarEn(batch, "submission.created", {
    teamId,
    teamNombre: team.get("nombre"),
    track: team.get("track"),
    repoUrl: repo.get("url"),
    tagSha: tag.sha,
    tagCommitAt: tag.commitAt.toISOString(),
    demoUrl,
    destinatarios,
    reenvio: antes.exists && !!antes.get("tagSha"),
  });
  await batch.commit();
  await despachar([evento]);
  return { tagSha: tag.sha, tagCommitAt: tag.commitAt };
}
