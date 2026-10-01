import "server-only";
import { FieldValue, type Transaction, type WriteBatch } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Registro de auditoría. Firestore no tiene triggers dentro de la base como PostgreSQL, así que
 * toda escritura sensible se hace con un batch o transacción que incluye su entrada en audit_log:
 * o se guardan ambas o ninguna (docs/DECISIONES.md, D-03).
 */
export interface EntradaAuditoria {
  actor: string; // uid, o "sistema:<origen>" para n8n/webhooks
  accion: string; // p. ej. "team.create", "score.submit", "guardian.validate"
  entidad: string; // colección
  entidadId: string;
  antes?: Record<string, unknown> | null;
  despues?: Record<string, unknown> | null;
}

export function auditarEn(escritura: WriteBatch | Transaction, e: EntradaAuditoria): void {
  const ref = adminDb().collection("audit_log").doc();
  (escritura as WriteBatch).set(ref, {
    actor: e.actor,
    accion: e.accion,
    entidad: e.entidad,
    entidadId: e.entidadId,
    antes: e.antes ?? null,
    despues: e.despues ?? null,
    timestamp: FieldValue.serverTimestamp(),
  });
}
