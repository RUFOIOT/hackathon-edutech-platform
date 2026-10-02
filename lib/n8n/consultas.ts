import "server-only";
import { z } from "zod";
import { EVENT, MENTORIA_TEMAS, fecha } from "@/config/event";
import { ahora } from "@/lib/event/reloj";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

/**
 * Consultas que n8n hace a la app desde sus workflows programados (WF-03, 05, 06, 07, 09).
 * La app decide qué equipos o personas aplican (las fechas y reglas viven en config/event.ts);
 * n8n solo redacta y envía. Cada consulta devuelve lo mínimo para su finalidad (LOPDP, D-39).
 */
export const consultaSchema = z.discriminatedUnion("consulta", [
  z.object({ consulta: z.literal("recordatorios-convocatoria") }),
  z.object({ consulta: z.literal("checkpoints-en-riesgo"), hito: z.enum(["checkpoint1", "checkpoint2", "freeze"]) }),
  z.object({ consulta: z.literal("reporte-entregas") }),
  z.object({ consulta: z.literal("mentores"), tema: z.enum(MENTORIA_TEMAS) }),
  z.object({ consulta: z.literal("mentoria-estado"), requestId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }),
  z.object({ consulta: z.literal("retroalimentacion"), teamId: z.string().regex(/^[a-z0-9-]{1,60}$/) }),
]);
export type Consulta = z.infer<typeof consultaSchema>;

const db = () => adminDb();
const enlace = (ruta: string) => `${process.env.APP_BASE_URL ?? ""}${ruta}`;

/** Correos de los integrantes de cada equipo (participantes fuera de lista de espera). */
async function correosPorEquipo(): Promise<Map<string, string[]>> {
  const participantes = await db().collection("participants").where("enListaEspera", "==", false).get();
  const mapa = new Map<string, string[]>();
  for (const p of participantes.docs) {
    const teamId = p.get("teamId") as string | null;
    const email = p.get("email") as string | undefined;
    if (!teamId || !email) continue;
    mapa.set(teamId, [...(mapa.get(teamId) ?? []), email]);
  }
  return mapa;
}

export async function ejecutarConsulta(c: Consulta): Promise<Record<string, unknown>> {
  const t = ahora();
  switch (c.consulta) {
    case "recordatorios-convocatoria": {
      const activo = t >= fecha("aperturaInscripciones") && t <= fecha("cierreInscripciones");
      if (!activo) return { activo: false };
      const [guardianes, equipos, correos] = await Promise.all([
        db().collection("guardians").where("estado", "==", "pendiente").get(),
        db().collection("teams").where("estado", "==", "incompleto").get(),
        correosPorEquipo(),
      ]);
      const juniors = guardianes.empty ? [] : await db().getAll(...guardianes.docs.map((g) => db().doc(`participants/${g.id}`)));
      const webinar = EVENT.fechas.webinar;
      const diasAlWebinar = (new Date(webinar.iso).getTime() - t.getTime()) / 86_400_000;
      return {
        activo: true,
        cierre: EVENT.fechas.cierreInscripciones.iso,
        autorizacionesPendientes: guardianes.docs.map((g, i) => ({
          nombres: juniors[i]?.get("nombres") ?? "",
          para: [juniors[i]?.get("email"), g.get("contacto.correo")].filter(Boolean),
          archivoSubido: !!g.get("archivoPath"),
          enlace: enlace("/mi-equipo"),
        })),
        equiposIncompletos: equipos.docs.map((e) => ({
          teamNombre: e.get("nombre"),
          miembros: e.get("miembros"),
          codigo: e.get("codigoInvitacion"),
          enlace: enlace(`/registro?codigo=${e.get("codigoInvitacion")}`),
          para: correos.get(e.id) ?? [],
        })),
        // Invitación al webinar solo en la semana previa y si la fecha está confirmada.
        webinar: webinar.confirmada && diasAlWebinar > 0 && diasAlWebinar <= 7 ? { fecha: webinar.iso, para: [...correos.values()].flat() } : null,
      };
    }

    case "checkpoints-en-riesgo": {
      const [equipos, repos, entregas, correos] = await Promise.all([
        db().collection("teams").get(),
        db().collection("repositories").get(),
        db().collection("submissions").get(),
        correosPorEquipo(),
      ]);
      const repo = new Map(repos.docs.map((r) => [r.id, r]));
      const entregado = new Set(entregas.docs.filter((s) => s.get("tagSha")).map((s) => s.id));
      const enRiesgo = equipos.docs
        .filter((e) => e.get("estado") !== "descalificado")
        .flatMap((e) => {
          const r = repo.get(e.id);
          let motivo: string | null = null;
          if (!r?.get("validado")) motivo = "El equipo aún no registra su repositorio.";
          else if (c.hito === "freeze") motivo = entregado.has(e.id) ? null : "Aún no envían el formulario de entrega ni crean el tag entrega.";
          else if (r.get(`ultimoSnapshot.${c.hito}`) !== "cumplido")
            motivo = c.hito === "checkpoint1" ? "El README aún no describe problema, usuario y arquitectura." : "Aún no hay una demo funcional mínima ejecutable.";
          return motivo ? [{ teamNombre: e.get("nombre"), motivo, para: correos.get(e.id) ?? [], enlace: enlace("/mi-equipo/repositorio") }] : [];
        });
      return { hito: c.hito, limite: fecha(c.hito === "freeze" ? "codeFreeze" : c.hito).toISOString(), enRiesgo };
    }

    case "reporte-entregas": {
      const [equipos, entregas, admis] = await Promise.all([db().collection("teams").get(), db().collection("submissions").get(), db().collection("admissibility").get()]);
      const sub = new Map(entregas.docs.map((s) => [s.id, s]));
      const adm = new Map(admis.docs.map((a) => [a.id, a]));
      const filas = equipos.docs
        .filter((e) => e.get("estado") !== "descalificado")
        .map((e) => {
          const s = sub.get(e.id);
          const a = adm.get(e.id);
          const criterios = ["a1", "a2", "a3", "a4", "a5"] as const;
          return {
            teamNombre: e.get("nombre"),
            track: e.get("track"),
            entregado: !!s?.get("tagSha"),
            tagMovidoTrasFreeze: !!s?.get("tagMovidoTrasFreeze"),
            fallas: a ? criterios.filter((k) => a.get(k) === false).map((k) => k.toUpperCase()) : [],
            a4Pendiente: !!a && (a.get("a4") === null || a.get("a4") === undefined),
          };
        });
      return {
        total: filas.length,
        entregados: filas.filter((f) => f.entregado).length,
        admisibles: filas.filter((f) => f.entregado && f.fallas.length === 0 && !f.tagMovidoTrasFreeze).length,
        equipos: filas,
        enlace: enlace("/admin/repositorios"),
      };
    }

    case "mentores": {
      const staff = await db().collection("staff").where("roles", "array-contains", "mentor").get();
      const delTema = staff.docs.filter((s) => {
        const temas = s.get("temas") as string[] | undefined;
        return !temas?.length || temas.includes(c.tema);
      });
      const usuarios = delTema.length ? (await adminAuth().getUsers(delTema.map((s) => ({ uid: s.id })))).users : [];
      return { tema: c.tema, para: usuarios.map((u) => u.email).filter(Boolean), enlace: enlace("/admin/mentoria") };
    }

    case "mentoria-estado": {
      const m = await db().doc(`mentor_requests/${c.requestId}`).get();
      if (!m.exists) return { existe: false };
      const abierta = m.get("abiertaAt")?.toDate?.() as Date | undefined;
      return {
        existe: true,
        estado: m.get("estado"),
        tema: m.get("tema"),
        minutosEspera: abierta ? Math.round((t.getTime() - abierta.getTime()) / 60_000) : null,
        enlace: enlace("/admin/mentoria"),
      };
    }

    case "retroalimentacion": {
      const r = await db().doc(`results/${c.teamId}`).get();
      if (!r.exists || !r.get("publicado")) return { publicado: false };
      return { publicado: true, fortalezas: r.get("fortalezas") ?? [], recomendaciones: r.get("recomendaciones") ?? [], enlace: enlace("/mi-equipo/resultado") };
    }
  }
}
