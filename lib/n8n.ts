import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cabecerasFirmadas, verificarFirma } from "@/lib/hmac";
import { log } from "@/lib/log";

/** Eventos que la app emite hacia n8n (prompt §8.2). */
export const TIPOS_EVENTO = [
  "registration.created",
  "team.invitation",
  "team.completed",
  "guardian.validated",
  "checkin.created",
  "mentor.requested",
  "submission.created",
  "announcement.created",
  "results.published",
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export interface Evento<P = Record<string, unknown>> {
  id: string;
  type: TipoEvento;
  occurredAt: string;
  payload: P;
}

export function crearEvento<P extends Record<string, unknown>>(type: TipoEvento, payload: P, id: string = randomUUID()): Evento<P> {
  return { id, type, occurredAt: new Date().toISOString(), payload };
}

export type ResultadoEnvio = { ok: true } | { ok: false; error: string };

/**
 * Envía un evento firmado a `${N8N_WEBHOOK_BASE_URL}/${type}`. No lanza: devuelve el resultado
 * para que el outbox (lib/eventos.ts) decida si reintentar. Sin URL configurada, no envía.
 */
export async function emitEvent(evento: Evento): Promise<ResultadoEnvio> {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  const secreto = process.env.N8N_SHARED_SECRET;
  if (!base || !secreto) return { ok: false, error: "n8n no configurado (N8N_WEBHOOK_BASE_URL / N8N_SHARED_SECRET)" };

  const cuerpo = JSON.stringify(evento);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/${evento.type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Event-Id": evento.id, ...cabecerasFirmadas(secreto, cuerpo) },
      body: cuerpo,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "error desconocido";
    log.warn("No se pudo enviar el evento a n8n", { tipo: evento.type, id: evento.id, error });
    return { ok: false, error };
  }
}

/**
 * Lee el cuerpo de una petición de n8n hacia la app y verifica X-Signature + X-Timestamp.
 * Devuelve el cuerpo crudo (el que se firmó) o la respuesta 401 lista para devolver.
 */
export async function leerPeticionFirmada(req: Request): Promise<{ ok: true; cuerpo: string } | { ok: false; respuesta: NextResponse }> {
  const cuerpo = await req.text();
  const firma = verificarFirma({
    secreto: process.env.N8N_SHARED_SECRET ?? "",
    cuerpo,
    timestamp: req.headers.get("x-timestamp"),
    firma: req.headers.get("x-signature"),
  });
  if (!process.env.N8N_SHARED_SECRET || !firma.ok) {
    return { ok: false, respuesta: NextResponse.json({ error: "Firma inválida", motivo: firma.ok ? "sin-secreto" : firma.motivo }, { status: 401 }) };
  }
  return { ok: true, cuerpo };
}
