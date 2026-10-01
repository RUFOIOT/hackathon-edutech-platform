import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Element, Root } from "hast";
import { toString } from "hast-util-to-string";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export interface Encabezado {
  id: string;
  texto: string;
  nivel: 2 | 3;
}

export interface Documento {
  titulo: string;
  html: string;
  indice: Encabezado[];
}

export const GUIAS = {
  guia: "01_GUIA_HACKATHON.md",
  "guia-hacker": "02_GUIA_HACKER.md",
  rubrica: "03_RUBRICA_EVALUACION.md",
} as const;

/** Palabras que identifican un dato institucional pendiente dentro de corchetes. */
const PENDIENTE = /CONFIRMAR|MONTO|BENEFICIO|LISTA|REVISI[ÓO]N LEGAL/i;

/**
 * Prepara una guía para publicarla. La guía dice que "los campos entre corchetes son decisiones
 * institucionales pendientes. No se publican hasta estar confirmados", así que:
 *
 * 1. Quita bloques internos: metadatos del borrador, la nota sobre corchetes, la alerta de
 *    calendario del POA y la sección "Decisiones pendientes" (docs/DECISIONES.md, D-13).
 * 2. `[CONFIRMAR …]`, `[MONTO USD]`, `[BENEFICIO]`, `[LISTA]` → "Por anunciar".
 * 3. Fechas propuestas entre corchetes (`[28 oct]`) → "28 oct (por confirmar)".
 *
 * No toca casillas de verificación (`[ ]`, `[x]`) ni enlaces Markdown (`[texto](url)`).
 */
export function prepararParaPublicar(md: string): string {
  let s = md;
  s = s.replace(/^\*\*(Versión|Responsable):\*\*.*\n/gm, "");
  // Líneas de metadatos seguidas ("**Fechas:** …") con salto de línea duro, no fundidas en un párrafo.
  s = s.replace(/^(\*\*[^*\n]+:\*\*.*)\n(?=\*\*[^*\n]+:\*\*)/gm, "$1  \n");
  s = s.replace(/^> Los campos entre corchetes.*\n\n?/gm, "");
  s = s.replace(/^> \*\*Alerta de calendario institucional\.\*\*.*\n\n?/gm, "");
  // Sección interna completa: desde su encabezado hasta el siguiente "## ".
  s = s.replace(/^## \d+\. Decisiones pendientes[\s\S]*?(?=^## )/m, "");

  // "[+ CONFIRMAR integrantes]": añadido pendiente a un valor ya publicado → se omite.
  s = s.replace(/\s*\[\+[^\]\n]*\]/g, "");
  // "[CONFIRMAR] frase." como marcador al inicio: la frase se publica marcada al final.
  s = s.replace(/\[CONFIRMAR\](?!\s*\|)\s*(.*?)(\.?)$/gm, "$1 (por confirmar)$2");
  // Celda de tabla que es solo el pendiente: "| [MONTO USD] |", "| [LISTA] · mínimo… |".
  s = s.replace(/(\|\s*)\[([^\]\n]*)\](?=[^|\n]*\|)/g, (todo, pre: string, t: string) =>
    PENDIENTE.test(t) ? `${pre}Por anunciar` : `${pre}${t.trim()} (por confirmar)`,
  );
  // Revisión legal pendiente de un texto publicado.
  s = s.replace(/\s*\[REVISI[ÓO]N LEGAL[^\]\n]*\]/gi, " (texto sujeto a revisión legal)");
  // Nota pendiente detrás de un valor: "`org` [CONFIRMAR nombre]", "n8n · [CONFIRMAR acuerdo]".
  s = s.replace(/(?:\s*·)?\s*\[([^\]\n]*)\](?!\()/g, (todo, dentro: string) => {
    const t = dentro.trim();
    if (t === "" || t === "x" || t === "X") return todo; // casilla de verificación
    if (PENDIENTE.test(t)) return " (por confirmar)";
    return ` ${t} (por confirmar)`;
  });
  return s;
}

/** Plugin rehype: recoge h2/h3 con su id (ya asignado por rehype-slug) para el índice lateral. */
function recogerIndice(indice: Encabezado[]) {
  return () => (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if ((node.tagName === "h2" || node.tagName === "h3") && typeof node.properties?.id === "string") {
        indice.push({ id: node.properties.id, texto: toString(node), nivel: node.tagName === "h2" ? 2 : 3 });
      }
    });
  };
}

/** Plugin rehype: envuelve cada tabla en un contenedor desplazable para no romper el ancho en móvil. */
function envolverTablas() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "table" || !parent || index === undefined) return;
      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["tabla-desplazable"], tabIndex: 0, role: "region", ariaLabel: "Tabla" },
        children: [node],
      };
      return index + 1; // no volver a visitar la tabla envuelta
    });
  };
}

/** Plugin rehype: las casillas de las checklists GFM (deshabilitadas) toman como etiqueta el texto del ítem. */
function etiquetarCasillas() {
  return (tree: Root) => {
    visit(tree, "element", (li: Element) => {
      if (li.tagName !== "li") return;
      const casilla = li.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "input" && c.properties?.type === "checkbox",
      );
      if (casilla) casilla.properties = { ...casilla.properties, ariaLabel: toString(li).trim() };
    });
  };
}

export async function renderMarkdown(md: string): Promise<Documento> {
  const indice: Encabezado[] = [];
  const titulo = /^# (.+)$/m.exec(md)?.[1]?.trim() ?? "";
  // El h1 lo pinta la página; se quita del cuerpo para no duplicarlo.
  const cuerpo = md.replace(/^# .+\n/m, "");
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(recogerIndice(indice))
    .use(envolverTablas)
    .use(etiquetarCasillas)
    .use(rehypeStringify)
    .process(cuerpo);
  return { titulo, html: String(file), indice };
}

/** Lee una guía de content/ y la devuelve lista para publicar. Contenido propio del repo, no de usuarios. */
export async function cargarGuia(clave: keyof typeof GUIAS): Promise<Documento> {
  const md = await readFile(path.join(process.cwd(), "content", GUIAS[clave]), "utf8");
  return renderMarkdown(prepararParaPublicar(md));
}
