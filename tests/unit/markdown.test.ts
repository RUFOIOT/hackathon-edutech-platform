import { describe, expect, it } from "vitest";
import { cargarGuia, prepararParaPublicar, renderMarkdown } from "@/lib/content/markdown";

describe("prepararParaPublicar", () => {
  it("celdas de tabla pendientes → 'Por anunciar'", () => {
    expect(prepararParaPublicar("| 1er lugar | Todos | [MONTO USD] |")).toBe("| 1er lugar | Todos | Por anunciar |");
    expect(prepararParaPublicar("| Mentores | x | [LISTA] · mínimo 1 |")).toBe("| Mentores | x | Por anunciar · mínimo 1 |");
    expect(prepararParaPublicar("| Coordinación | Sede | [CONFIRMAR] |")).toBe("| Coordinación | Sede | Por anunciar |");
  });

  it("notas pendientes detrás de un valor → '(por confirmar)'", () => {
    expect(prepararParaPublicar("**Org:** `eight-academy-hackathon` [CONFIRMAR nombre disponible].")).toBe(
      "**Org:** `eight-academy-hackathon` (por confirmar).",
    );
    expect(prepararParaPublicar("**Aliado:** n8n · [CONFIRMAR acuerdo de uso de marca]")).toBe("**Aliado:** n8n (por confirmar)");
  });

  it("marcador [CONFIRMAR] al inicio de una frase la marca al final", () => {
    expect(prepararParaPublicar("- [CONFIRMAR] Cupo máximo: 30 equipos.")).toBe("- Cupo máximo: 30 equipos (por confirmar).");
  });

  it("añadidos [+ CONFIRMAR …] se omiten y la revisión legal se indica", () => {
    expect(prepararParaPublicar("| Comité | x | Dirección [+ CONFIRMAR integrantes] |")).toBe("| Comité | x | Dirección |");
    expect(prepararParaPublicar("Licencia. [REVISIÓN LEGAL antes de publicar]")).toBe("Licencia. (texto sujeto a revisión legal)");
  });

  it("marca las fechas propuestas como por confirmar", () => {
    expect(prepararParaPublicar("| [28 oct] | Webinar |")).toBe("| 28 oct (por confirmar) | Webinar |");
  });

  it("no toca casillas ni enlaces", () => {
    expect(prepararParaPublicar("- [ ] Tarea\n- [x] Hecha")).toBe("- [ ] Tarea\n- [x] Hecha");
    expect(prepararParaPublicar("[la guía](/guia)")).toBe("[la guía](/guia)");
  });

  it("quita la sección interna de decisiones pendientes y deja la siguiente", () => {
    const md = "## 11. PI\n\ntexto\n\n## 12. Decisiones pendientes antes de abrir\n\n| a | b |\n\n## 13. Cronograma\n\nhitos\n";
    const out = prepararParaPublicar(md);
    expect(out).not.toContain("Decisiones pendientes");
    expect(out).toContain("## 13. Cronograma");
  });
});

describe("guías publicadas", () => {
  it("la guía del hackathon no publica corchetes institucionales ni notas internas", async () => {
    const { html, titulo } = await cargarGuia("guia");
    expect(titulo).toMatch(/Guía oficial/);
    expect(html).not.toMatch(/\[(CONFIRMAR|MONTO|BENEFICIO|LISTA)/);
    expect(html).not.toMatch(/Alerta de calendario|Decisiones pendientes|borrador para aprobación|Felipe Salgado/);
    expect(html).toContain("Por anunciar");
    expect(html).not.toMatch(/Por anunciar Cupo|\] /);
  });

  it("genera índice con anclas y envuelve tablas para móvil", async () => {
    const { html, indice } = await cargarGuia("rubrica");
    expect(indice.some((h) => h.nivel === 2 && h.id === "2-criterios-y-pesos")).toBe(true);
    expect(html).toContain('id="2-criterios-y-pesos"');
    expect(html).toContain('class="tabla-desplazable"');
  });

  it("las casillas de las checklists tienen etiqueta accesible", async () => {
    const { html } = await renderMarkdown("- [ ] Cuenta de GitHub activa");
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*aria-label="Cuenta de GitHub activa"/);
  });

  it("el título h1 no se duplica en el cuerpo", async () => {
    const doc = await renderMarkdown("# Título\n\n## Sección\n\ntexto");
    expect(doc.titulo).toBe("Título");
    expect(doc.html).not.toContain("<h1");
  });
});
