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
