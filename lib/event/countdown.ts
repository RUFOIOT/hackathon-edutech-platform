import { TIMEZONE } from "@/config/event";

export interface Restante {
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
  terminado: boolean;
}

/** Tiempo restante hasta `objetivo`. Es una resta de instantes: no depende de zonas horarias. */
export function restante(objetivo: Date, ahora: Date): Restante {
  const ms = objetivo.getTime() - ahora.getTime();
  if (ms <= 0) return { dias: 0, horas: 0, minutos: 0, segundos: 0, terminado: true };
  const total = Math.floor(ms / 1000);
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
    terminado: false,
  };
}

/** "viernes, 6 de noviembre, 15:30" en hora de Ecuador, sin importar la zona del navegador o servidor. */
export function fechaEnEcuador(d: Date): string {
  const fecha = new Intl.DateTimeFormat("es-EC", { timeZone: TIMEZONE, weekday: "long", day: "numeric", month: "long" }).format(d);
  const hora = new Intl.DateTimeFormat("es-EC", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `${fecha}, ${hora}`;
}

/** "lunes 5 de octubre" en hora de Ecuador. */
export function diaEnEcuador(d: Date): string {
  return new Intl.DateTimeFormat("es-EC", { timeZone: TIMEZONE, weekday: "long", day: "numeric", month: "long" })
    .format(d)
    .replace(",", "");
}

/** Texto accesible del contador, para lectores de pantalla. */
export function restanteEnPalabras(r: Restante): string {
  if (r.terminado) return "El hackathon ya comenzó.";
  const p = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  return `Faltan ${p(r.dias, "día", "días")}, ${p(r.horas, "hora", "horas")} y ${p(r.minutos, "minuto", "minutos")} para el kick-off.`;
}
