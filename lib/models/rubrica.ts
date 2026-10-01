/**
 * Rúbrica oficial (content/03_RUBRICA_EVALUACION.md §2 y §3). Se siembra en `rubric_criteria`
 * y la usa la lógica de puntaje (Fase 5). Si cambia la rúbrica, cambia aquí.
 */
export type CriterioCodigo = "C1" | "C2" | "C3" | "C4" | "C5" | "C6";

export interface Criterio {
  codigo: CriterioCodigo;
  nombre: string;
  peso: number; // porcentaje sobre 100
  descriptores: Record<1 | 2 | 3 | 4 | 5, string>;
}

export const RUBRICA: Criterio[] = [
  {
    codigo: "C1",
    nombre: "Problema y usuario",
    peso: 20,
    descriptores: {
      5: "Problema específico, con evidencia de campo (entrevistas o datos) y un usuario concreto. El equipo sabe qué no va a resolver.",
      4: "Problema claro con un usuario identificado y alguna evidencia, aunque parcial.",
      3: "Problema razonable pero genérico; el usuario se describe como categoría (\"los estudiantes\").",
      2: "El problema se infiere de la solución, sin evidencia.",
      1: "No se identifica un problema educativo real.",
    },
  },
  {
    codigo: "C2",
    nombre: "Solución funcionando en vivo",
    peso: 25,
    descriptores: {
      5: "El flujo principal corre en vivo de punta a punta, con datos, sin intervención manual oculta.",
      4: "Funciona en vivo con fallas menores que no impiden entender el valor.",
      3: "Funciona parcialmente; una parte clave se muestra simulada y el equipo lo declara.",
      2: "Solo se muestran pantallas o un video; nada se ejecuta en vivo.",
      1: "No hay producto demostrable.",
    },
  },
  {
    codigo: "C3",
    nombre: "Calidad técnica y repositorio",
    peso: 15,
    descriptores: {
      5: "Arquitectura coherente, código legible, README permite ejecutarlo, historial de commits distribuido en el tiempo y entre integrantes, sin secretos expuestos.",
      4: "Buena estructura con huecos menores de documentación o historial.",
      3: "Funciona, pero el repositorio es difícil de seguir o el historial está concentrado en pocos commits.",
      2: "Código desordenado, sin instrucciones de ejecución.",
      1: "Repositorio incompleto o con secretos expuestos.",
    },
  },
  {
    codigo: "C4",
    nombre: "Automatización e inteligencia (n8n / IA)",
    peso: 15,
    descriptores: {
      5: "La automatización o la IA resuelve una parte esencial del problema, con criterio: el equipo explica qué verifica, cuáles son los límites y qué pasa si falla. Workflows exportados en el repositorio.",
      4: "Uso relevante y bien integrado, con explicación parcial de límites.",
      3: "Uso correcto pero accesorio; el producto funcionaría casi igual sin él.",
      2: "Uso decorativo o no verificado.",
      1: "No hay automatización ni IA, o su uso no se declaró.",
    },
  },
  {
    codigo: "C5",
    nombre: "Viabilidad e impacto en la institución educativa",
    peso: 10,
    descriptores: {
      5: "Ruta clara de adopción en una institución real: quién la usa, quién paga o quién la sostiene, costo aproximado y siguiente paso concreto.",
      4: "Ruta de adopción plausible con supuestos razonables.",
      3: "Se menciona un modelo, sin validar.",
      2: "Impacto declarado sin ruta.",
      1: "No se considera la adopción.",
    },
  },
  {
    codigo: "C6",
    nombre: "Show and Tell",
    peso: 15,
    descriptores: {
      5: "Narrativa clara, demo bien guiada, dentro de los 8 minutos, respuestas precisas al jurado.",
      4: "Clara y dentro de tiempo, con algún tramo confuso.",
      3: "Se entiende, pero excede el tiempo o las respuestas son vagas.",
      2: "Desordenada; el jurado no logra entender el valor.",
      1: "No se presenta o no se ajusta al formato.",
    },
  },
];

/** Regla de no compensación (rúbrica §2): C2 = 1 limita el total a 60/100. Se aplica por juez (D-05). */
export const TOPE_C2_UNO = 60;
