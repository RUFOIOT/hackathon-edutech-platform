import { describe, expect, it } from "vitest";
import {
  ERROR_EJEMPLO,
  ESCENARIOS_PROGRAMADOS,
  EVENTOS_EJEMPLO,
  cargarWorkflows,
  firmarComoApp,
  itemWebhook,
  mockApp,
  revisarTraza,
  simular,
  validarWorkflow,
  webhookDe,
} from "../../scripts/n8n-simulador";

/** Los mismos tipos que lib/n8n.ts (ese módulo es server-only y no se importa aquí). */
const TIPOS = [
  "registration.created",
  "team.invitation",
  "team.completed",
  "guardian.validated",
  "checkin.created",
  "mentor.requested",
  "submission.created",
  "announcement.created",
  "results.published",
];

const evento = (tipo: string) => JSON.stringify({ id: `ev-${tipo}`, type: tipo, occurredAt: new Date().toISOString(), payload: EVENTOS_EJEMPLO[tipo]!.payload });

describe("workflows de n8n", () => {
  const workflows = cargarWorkflows();

  it("están los 9 del prompt más el de reintentos y el de reporte de errores", () => {
    expect(workflows.map((w) => w.archivo.slice(0, 5))).toEqual(["WF-00", "WF-01", "WF-02", "WF-03", "WF-04", "WF-05", "WF-06", "WF-07", "WF-08", "WF-09", "WF-99"]);
  });

  it.each(workflows.map((w) => [w.archivo, w.wf] as const))("%s es válido: conexiones, credenciales por referencia, sin secretos", (_, wf) => {
    expect(validarWorkflow(wf)).toEqual([]);
  });

  it("cada evento que emite la app tiene exactamente un webhook", () => {
    const paths = workflows.flatMap((w) => w.wf.nodes.filter((n) => n.type === "n8n-nodes-base.webhook").map((n) => n.parameters.path));
    expect([...paths].sort()).toEqual([...TIPOS].sort());
  });
});

describe("eventos firmados por la app", () => {
  it.each(TIPOS)("%s: el workflow acepta la firma, responde 200 y envía lo esperado", async (tipo) => {
    const cuerpo = evento(tipo);
    const destino = webhookDe(tipo)!;
    const t = await simular(destino.wf, destino.nodo, [itemWebhook(cuerpo, firmarComoApp(cuerpo))], { mock: mockApp() });
    expect(t.respuestas).toEqual([200]);
    expect(revisarTraza(t, EVENTOS_EJEMPLO[tipo]!)).toEqual([]);
  });

  it("rechaza con 401 un cuerpo alterado, un timestamp viejo o un secreto distinto, sin enviar nada", async () => {
    const cuerpo = evento("announcement.created");
    const { wf, nodo } = webhookDe("announcement.created")!;
    const casos = [
      itemWebhook(cuerpo.replace("aula 204", "aula 999"), firmarComoApp(cuerpo)),
      itemWebhook(cuerpo, firmarComoApp(cuerpo, undefined, new Date(Date.now() - 10 * 60_000))),
      itemWebhook(cuerpo, firmarComoApp(cuerpo, "otro-secreto-distinto-0123456789abcdef")),
      itemWebhook(cuerpo, {}),
    ];
    for (const item of casos) {
      const t = await simular(wf, nodo, [item], { mock: mockApp() });
      expect(t.respuestas).toEqual([401]);
      expect(t.correos).toHaveLength(0);
      expect(t.slack).toHaveLength(0);
    }
  });

  it("WF-09 adjunta un certificado por integrante con correo y firma cada petición a la app", async () => {
    const cuerpo = evento("results.published");
    const { wf, nodo } = webhookDe("results.published")!;
    const t = await simular(wf, nodo, [itemWebhook(cuerpo, firmarComoApp(cuerpo))], { mock: mockApp() });
    const certificados = t.llamadasApp.filter((l) => l.ruta === "/api/n8n/certificado").map((l) => l.cuerpo);
    expect(certificados).toEqual([
      { nombre: "Ana Pérez", equipo: "Los Nodos", tipo: "ganador", premio: "1er lugar general" },
      { nombre: "Luis", equipo: "Otro", tipo: "participacion", premio: null },
    ]);
    for (const c of t.correos) expect((c.adjuntos as { content: string }[])[0]!.content).toBe(Buffer.from("%PDF-1.7 simulado").toString("base64"));
  });
});

describe("workflows programados", () => {
  const porArchivo = new Map(cargarWorkflows().map((w) => [w.archivo, w.wf]));

  it.each(ESCENARIOS_PROGRAMADOS.map((e) => [`${e.archivo} · ${e.disparador}`, e] as const))("%s", async (_, e) => {
    const t = await simular(porArchivo.get(e.archivo)!, e.disparador, [{ json: {} }], { mock: mockApp() });
    expect(revisarTraza(t, e)).toEqual([]);
    if (e.consulta) expect(t.llamadasApp.map((l) => l.cuerpo)).toContainEqual(e.consulta);
  });

  it("WF-03 no envía nada cuando la app dice que la convocatoria cerró", async () => {
    const base = mockApp();
    const t = await simular(porArchivo.get("WF-03-recordatorios-convocatoria.json")!, "Cada día a las 09:00", [{ json: {} }], {
      mock: (ruta, cuerpo) => (cuerpo.consulta === "recordatorios-convocatoria" ? { activo: false } : base(ruta, cuerpo)),
    });
    expect(t.correos).toHaveLength(0);
    expect(t.slack).toHaveLength(0);
  });

  it("WF-04 no repite una alerta ya avisada", async () => {
    const estatico = {};
    const wf = porArchivo.get("WF-04-monitor-repositorios.json")!;
    const primera = await simular(wf, "Cada 15 min en la ventana", [{ json: {} }], { mock: mockApp(), estatico });
    const segunda = await simular(wf, "Cada 15 min en la ventana", [{ json: {} }], { mock: mockApp(), estatico });
    expect(primera.correos).toHaveLength(1);
    expect(segunda.correos).toHaveLength(0);
  });
});

describe("reporte de errores (plantilla 2159)", () => {
  it("WF-99 avisa al staff con el workflow, el nodo, el error y el enlace a la ejecución", async () => {
    const wf = cargarWorkflows().find((w) => w.archivo.startsWith("WF-99"))!.wf;
    const t = await simular(wf, "Error en un workflow", [{ json: ERROR_EJEMPLO }], { mock: mockApp() });
    expect(t.slack).toHaveLength(1);
    expect(t.slack[0]).toContain("WF-01 · Confirmación de inscripción");
    expect(t.slack[0]).toContain("401 Unauthorized");
    expect(t.slack[0]).toContain("https://n8n.ejemplo/execution/231");
  });
});
