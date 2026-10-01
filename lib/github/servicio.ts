import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { EVENT, fecha, type TrackCode } from "@/config/event";
import { auditarEn } from "@/lib/audit";
import { ahora } from "@/lib/event/reloj";
import { adminDb } from "@/lib/firebase/admin";
import { snapshotRepo, validateRepo, type CacheSecretos, type ResultadoValidacion, type Snapshot } from "@/lib/github";
import { clienteGithub } from "@/lib/github/cliente";
import type { Hallazgo } from "@/lib/github/secretos";
import type { MovimientoTag } from "@/lib/github/webhook";

/** Persistencia de la integración con GitHub: repositorios, snapshots y movimientos del tag. */

const db = () => adminDb();

/** Caché de análisis de secretos por SHA de blob (colección blob_scans, solo servidor). */
const cacheFirestore: CacheSecretos = {
  async leer(shas) {
    const r = new Map<string, Omit<Hallazgo, "archivo">[]>();
    for (let i = 0; i < shas.length; i += 100) {
      const refs = shas.slice(i, i + 100).map((s) => db().doc(`blob_scans/${s}`));
      if (!refs.length) continue;
      for (const snap of await db().getAll(...refs)) if (snap.exists) r.set(snap.id, snap.get("hallazgos"));
    }
    return r;
  },
  async guardar(resultados) {
    const batch = db().batch();
    for (const [sha, hallazgos] of resultados) batch.set(db().doc(`blob_scans/${sha}`), { hallazgos, analizadoAt: FieldValue.serverTimestamp() });
    await batch.commit();
  },
};

export async function registrarRepositorio(teamId: string, url: string, actor: string): Promise<ResultadoValidacion> {
  const team = await db().doc(`teams/${teamId}`).get();
  if (!team.exists) throw new Error("Equipo inexistente");
  const validacion = await validateRepo(url, { slug: team.get("slug"), track: team.get("track") as TrackCode }, clienteGithub);
  const ref = db().doc(`repositories/${teamId}`);
  const antes = await ref.get();
  const batch = db().batch();
  batch.set(ref, {
    teamId,
    url: url.trim(),
    owner: validacion.owner,
    name: validacion.name,
    fullName: validacion.owner && validacion.name ? `${validacion.owner}/${validacion.name}`.toLowerCase() : null,
    createdAtGithub: validacion.createdAt ? Timestamp.fromDate(validacion.createdAt) : null,
    defaultBranch: validacion.defaultBranch,
    validado: validacion.valido,
    motivos: validacion.chequeos.filter((c) => !c.ok).map((c) => c.mensaje),
    chequeos: validacion.chequeos,
    registradoPor: actor,
    actualizadoAt: FieldValue.serverTimestamp(),
  });
  auditarEn(batch, {
    actor,
    accion: "repository.register",
    entidad: "repositories",
    entidadId: teamId,
    antes: antes.exists ? { url: antes.get("url"), validado: antes.get("validado") } : null,
    despues: { url: url.trim(), validado: validacion.valido },
  });
  await batch.commit();
  return validacion;
}

function serializarSnapshot(teamId: string, s: Snapshot) {
  return {
    repositoryId: teamId,
    teamId,
    tomadoEn: Timestamp.fromDate(s.tomadoEn),
    commitsEnVentana: s.commitsEnVentana,
    autores: s.autores,
    ultimoCommitAt: s.ultimoCommitAt ? Timestamp.fromDate(s.ultimoCommitAt) : null,
    commitsPorHora: s.commitsPorHora,
    archivosObligatorios: s.archivosObligatorios,
    alertas: s.alertas,
    checkpoint1: s.checkpoint1,
    checkpoint2: s.checkpoint2,
    checkpoint2RequiereRevision: s.checkpoint2RequiereRevision,
  };
}

/** Toma un snapshot del repositorio del equipo y lo guarda (historial + resumen en repositories). */
export async function tomarSnapshot(teamId: string): Promise<(Snapshot & { teamId: string }) | null> {
  const repo = await db().doc(`repositories/${teamId}`).get();
  if (!repo.exists || !repo.get("owner") || !repo.get("createdAtGithub")) return null;
  const s = await snapshotRepo(
    {
      owner: repo.get("owner"),
      name: repo.get("name"),
      createdAt: (repo.get("createdAtGithub") as Timestamp).toDate(),
      defaultBranch: repo.get("defaultBranch") ?? "main",
    },
    clienteGithub,
    { ahora: ahora(), cache: cacheFirestore },
  );
  const datos = serializarSnapshot(teamId, s);
  const batch = db().batch();
  batch.set(db().collection("repo_snapshots").doc(), datos);
  batch.update(repo.ref, { ultimoSnapshot: datos });
  await batch.commit();
  return { ...s, teamId };
}

/**
 * Registra un movimiento del tag de entrega recibido por webhook. Si ocurre después del code
 * freeze, marca la entrega para revisión del comité (A2, rúbrica §1).
 */
export async function registrarMovimientoTag(entregaId: string, m: MovimientoTag): Promise<{ teamId: string | null; trasFreeze: boolean }> {
  const q = await db().collection("repositories").where("fullName", "==", m.repo.toLowerCase()).limit(1).get();
  const teamId = q.docs[0]?.id ?? null;
  const momento = ahora();
  const trasFreeze = momento.getTime() >= fecha("codeFreeze").getTime();
  const batch = db().batch();
  // El id del documento es el X-GitHub-Delivery: un reintento de GitHub no duplica el registro.
  batch.set(db().doc(`tag_events/${entregaId}`), {
    repo: m.repo,
    teamId,
    tag: EVENT.tagEntrega,
    accion: m.accion,
    sha: m.sha,
    recibidoAt: Timestamp.fromDate(momento),
    trasFreeze,
  });
  if (teamId && trasFreeze) {
    batch.set(db().doc(`submissions/${teamId}`), { tagMovidoTrasFreeze: true, tagMovimientos: FieldValue.arrayUnion(entregaId) }, { merge: true });
    auditarEn(batch, {
      actor: "sistema:github-webhook",
      accion: "tag.moved_after_freeze",
      entidad: "submissions",
      entidadId: teamId,
      despues: { accion: m.accion, sha: m.sha },
    });
  }
  await batch.commit();
  return { teamId, trasFreeze };
}
