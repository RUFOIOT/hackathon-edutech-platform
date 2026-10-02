import "server-only";
import { FieldValue, type Transaction, type WriteBatch } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { crearEvento, emitEvent, type Evento, type TipoEvento } from "@/lib/n8n";

/**
 * Outbox de eventos (D-19). El evento se guarda en `event_outbox` en el MISMO batch o transacción
 * que el cambio que lo origina, y se envía a n8n después del commit. Si n8n no responde, el evento
 * queda "pendiente" y se reintenta (Fase 7). Así una caída de n8n no pierde correos ni bloquea
 * inscripciones.
 */
export function encolarEn<P extends Record<string, unknown>>(escritura: WriteBatch | Transaction, tipo: TipoEvento, payload: P): Evento<P> {
  const ref = adminDb().collection("event_outbox").doc();
  const evento = crearEvento(tipo, payload, ref.id);
  (escritura as WriteBatch).set(ref, { ...evento, estado: "pendiente", intentos: 0, creadoAt: FieldValue.serverTimestamp(), ultimoError: null });
  return evento;
}

/** Envía los eventos indicados y marca su estado. Nunca lanza. */
export async function despachar(eventos: Evento[]): Promise<void> {
  await Promise.all(
    eventos.map(async (evento) => {
      const r = await emitEvent(evento);
      await adminDb()
        .doc(`event_outbox/${evento.id}`)
        .update(
          r.ok
            ? { estado: "enviado", enviadoAt: FieldValue.serverTimestamp(), intentos: FieldValue.increment(1) }
            : { estado: "pendiente", ultimoError: r.error, intentos: FieldValue.increment(1) },
        )
        .catch(() => undefined);
    }),
  );
}

export const MAX_INTENTOS = 10;

/**
 * Reintenta los eventos pendientes del outbox (lo invoca WF-00 cada 5 minutos). Omite los creados
 * hace menos de un minuto, que todavía están en su primer envío. Tras MAX_INTENTOS fallidos el
 * evento queda "fallido" y aparece en el runbook para revisarlo a mano.
 */
export async function reintentarPendientes(ahora: Date = new Date(), limite = 100): Promise<{ enviados: number; pendientes: number; fallidos: number }> {
  const snap = await adminDb().collection("event_outbox").where("estado", "==", "pendiente").limit(limite).get();
  const listos = snap.docs.filter((d) => {
    const creado = d.get("creadoAt")?.toDate?.() as Date | undefined;
    return !creado || ahora.getTime() - creado.getTime() >= 60_000;
  });
  let enviados = 0;
  let fallidos = 0;
  for (const d of listos) {
    const { id, type, occurredAt, payload } = d.data() as Evento;
    const r = await emitEvent({ id, type, occurredAt, payload });
    const intentos = Number(d.get("intentos") ?? 0) + 1;
    if (r.ok) enviados++;
    else if (intentos >= MAX_INTENTOS) fallidos++;
    await d.ref
      .update(
        r.ok
          ? { estado: "enviado", enviadoAt: FieldValue.serverTimestamp(), intentos }
          : { estado: intentos >= MAX_INTENTOS ? "fallido" : "pendiente", ultimoError: r.error, intentos },
      )
      .catch(() => undefined);
  }
  return { enviados, pendientes: listos.length - enviados - fallidos, fallidos };
}
