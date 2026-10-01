import { expect, test } from "@playwright/test";
import { alerta, correoUnico, eventosDe, inscribirEquipo } from "./ayudas";

/**
 * Repositorio y entrega (Fase 4). El equipo se inscribe en la app con fecha de convocatoria
 * (:3100) y luego opera en una segunda instancia con la hora simulada en plena ventana de
 * hacking (:3101, sábado 11:00). La cookie de sesión es por host, así que sirve en ambas.
 * GitHub es el servidor simulado (tests/e2e/servidor-simulado.mjs).
 */
const HACKING = "http://localhost:3101";

test.describe("repositorio y entrega", () => {
  test.describe.configure({ timeout: 120_000 });

  test("registra el repo con validaciones explicadas, muestra métricas y entrega con el SHA del tag", async ({ browser }) => {
    const nombre = `Entrega E2E ${Date.now()}`;
    const slug = nombre.toLowerCase().replace(/\s+/g, "-");
    const { ctx, page } = await inscribirEquipo(browser, { email: correoUnico("entrega"), invitado: correoUnico("inv"), nombre });

    // Repositorio fuera de la organización: cada chequeo dice qué falla.
    await page.goto(`${HACKING}/mi-equipo/repositorio`);
    await page.getByLabel("URL del repositorio").fill(`https://github.com/otra-org/edutech26-t3-${slug}`);
    await page.getByRole("button", { name: "Registrar repositorio" }).click();
    await expect(page.getByRole("status")).toContainText("no cumple todas las validaciones");
    await expect(page.getByRole("status")).toContainText("debe estar en la organización eight-academy-hackathon");

    // Repositorio correcto.
    await page.getByLabel("URL del repositorio").fill(`https://github.com/eight-academy-hackathon/edutech26-t3-${slug}`);
    await page.getByRole("button", { name: "Registrar repositorio" }).click();
    await expect(page.getByRole("status")).toContainText("Repositorio registrado y validado.");
    await page.reload();
    const metricas = page.getByRole("region", { name: "Métricas leídas de GitHub" });
    await expect(metricas.getByText("Commits en la ventana")).toBeVisible();
    await expect(metricas.locator("dd").first()).toHaveText("4");
    await expect(metricas.getByText("ana-e2e, luis-e2e")).toBeVisible();
    await expect(metricas.getByRole("row", { name: /Checkpoint 1/ })).toContainText("Cumplido");

    // Entrega: sin declaraciones no pasa, y el error lo explica.
    await page.goto(`${HACKING}/mi-equipo/entrega`);
    await page.getByLabel("Enlace a la demo").fill("https://demo.example.edu.ec");
    await page.getByLabel("PDF del pitch (máximo 20 MB)").setInputFiles({
      name: "pitch.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% pitch de prueba\n%%EOF"),
    });
    await page.getByRole("button", { name: "Entregar proyecto" }).click();
    await expect(alerta(page)).toContainText("Declara que usaron solo datos sintéticos");

    for (const casilla of [/datos sintéticos/, /PRIOR_WORK\.md/, /AI_USAGE\.md/]) await page.getByRole("checkbox", { name: casilla }).check();
    await page.getByRole("button", { name: "Entregar proyecto" }).click();
    const confirmacion = page.getByRole("status").filter({ hasText: "Proyecto entregado" });
    await expect(confirmacion).toContainText("e2e0c0ffee1234567890abcdef1234567890abcd");
    await expect(confirmacion).toContainText("11:50");

    await expect
      .poll(async () => (await eventosDe((e) => e.ruta === "submission.created" && e.evento?.payload.teamNombre === nombre)).map((e) => e.firmaValida))
      .toEqual([true]);
    const [ev] = await eventosDe((e) => e.ruta === "submission.created" && e.evento?.payload.teamNombre === nombre);
    expect(ev!.evento!.payload).toMatchObject({
      tagSha: "e2e0c0ffee1234567890abcdef1234567890abcd",
      demoUrl: "https://demo.example.edu.ec",
      reenvio: false,
    });
    await ctx.close();
  });
});
