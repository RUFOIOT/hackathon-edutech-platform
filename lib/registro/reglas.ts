import { randomInt } from "node:crypto";
import { EVENT } from "@/config/event";

/** Reglas de negocio del registro (prompt §5.1), puras y testeables. */

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I para dictarlo sin errores

export function generarCodigo(): string {
  return Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
}

export function slugEquipo(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40)
    .replace(/-$/, "");
}

export interface Conteos {
  personas: number; // inscritos que no están en lista de espera
  equipos: number;
}

/**
 * ¿La nueva inscripción entra o va a lista de espera? Se llena el cupo de personas, o el de
 * equipos si la persona crea uno nuevo.
 */
export function vaAListaEspera(c: Conteos, creaEquipo: boolean, cupo: { maxPersonas: number; maxEquipos: number } = EVENT.cupo): boolean {
  if (c.personas >= cupo.maxPersonas) return true;
  return creaEquipo && c.equipos >= cupo.maxEquipos;
}

/** Estado del equipo según integrantes: completo con 2 a 5. */
export function estadoEquipo(miembros: number): "incompleto" | "completo" {
  return miembros >= EVENT.equipo.min && miembros <= EVENT.equipo.max ? "completo" : "incompleto";
}

/** ¿Cabe una persona más? Cuenta integrantes ya inscritos. */
export function hayLugar(miembros: number): boolean {
  return miembros < EVENT.equipo.max;
}

/** Correos de invitación que se pueden enviar sin pasar de 5 (integrantes + invitaciones pendientes). */
export function invitacionesPermitidas(miembros: number, pendientes: number): number {
  return Math.max(0, EVENT.equipo.max - miembros - pendientes);
}
