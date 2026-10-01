/**
 * Textos de consentimiento (LOPDP, prompt §10). Cada uno declara su finalidad y lleva versión:
 * si el texto cambia, sube la versión, y cada aceptación guarda la versión exacta que se mostró.
 * Borrador pendiente de revisión legal y del DECE (guía §12, decisión 6).
 */
export const VERSION_CONSENTIMIENTOS = "2026-10-v1";

export type TipoConsentimiento = "reglas" | "datos_personales" | "uso_imagen" | "autorizacion_menor";

export interface TextoConsentimiento {
  tipo: TipoConsentimiento;
  titulo: string;
  texto: string;
  obligatorio: boolean;
}

export const CONSENTIMIENTOS: Record<TipoConsentimiento, TextoConsentimiento> = {
  reglas: {
    tipo: "reglas",
    titulo: "Reglas y código de conducta",
    texto:
      "Acepto las reglas del hackathon publicadas en la guía oficial y la rúbrica, y el código de conducta: respeto, inclusión y cero tolerancia al acoso. Entiendo que incumplirlo es causal de descalificación.",
    obligatorio: true,
  },
  datos_personales: {
    tipo: "datos_personales",
    titulo: "Tratamiento de datos personales",
    texto:
      "Autorizo a Eight Academy a tratar los datos de este formulario con una única finalidad: organizar el hackathon (inscripción, formación de equipos, check-in, comunicaciones del evento, evaluación y entrega de certificados). No se usan para otros fines ni se ceden a terceros, salvo a los proveedores que operan la plataforma. Se conservan hasta 12 meses después del evento y luego se anonimizan. Puedo pedir acceso, rectificación o eliminación desde Mi equipo.",
    obligatorio: true,
  },
  uso_imagen: {
    tipo: "uso_imagen",
    titulo: "Uso de imagen (opcional)",
    texto:
      "Autorizo el uso de fotos y videos en los que aparezca durante el evento, con la única finalidad de comunicar el hackathon en los canales de Eight Academy. Puedo inscribirme sin aceptar esto.",
    obligatorio: false,
  },
  autorizacion_menor: {
    tipo: "autorizacion_menor",
    titulo: "Autorización del representante legal",
    texto:
      "Declaro que soy el representante legal de la persona inscrita, que autorizo su participación en el hackathon los días 6 y 7 de noviembre de 2026 y que el documento adjunto está firmado por mí. Mi cédula se usa solo para verificar esta autorización.",
    obligatorio: true,
  },
};
