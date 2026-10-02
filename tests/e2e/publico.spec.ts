import { expect, test } from "@playwright/test";

const PUBLICAS = ["/", "/tracks", "/guia", "/guia-hacker", "/rubrica", "/privacidad"];

test.describe("cuenta regresiva", () => {
  test("muestra el tiempo correcto al kick-off en hora de Ecuador, aunque el navegador esté en otra zona", async ({ browser }) => {
    // Navegador en Tokio: el resultado debe ser el mismo porque es una resta de instantes.
    const ctx = await browser.newContext({ timezoneId: "Asia/Tokyo", viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    // 1 oct 2026 09:00 en Ecuador → faltan 36 días y 06:30:00.
    await page.clock.setFixedTime(new Date("2026-10-01T09:00:00-05:00"));
    await page.goto("/");
    const timer = page.getByRole("timer");
    await expect(timer).toContainText("6 de noviembre, 15:30 (hora de Ecuador)");
    await expect(timer).toContainText("36");
    await expect(timer).toContainText("06:30:00");
    await expect(timer).toContainText("Faltan 36 días, 6 horas y 30 minutos para el kick-off.");
    await ctx.close();
  });

  test("después del kick-off indica que el hackathon está en marcha", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-06T16:00:00-05:00"));
    await page.goto("/");
    await expect(page.getByRole("timer")).toContainText("El hackathon está en marcha");
  });
});

test.describe("movimiento", () => {
  test("el trazo del infinito se anima por defecto", async ({ page }) => {
    await page.goto("/");
    const nombre = await page.locator(".trazo-infinito").evaluate((el) => getComputedStyle(el).animationName);
    expect(nombre).toBe("recorrer-infinito");
  });

  test("con prefers-reduced-motion no hay animación y el trazo se ve completo", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    const estilo = await page
      .locator(".trazo-infinito")
      .evaluate((el) => ({ anim: getComputedStyle(el).animationName, dash: getComputedStyle(el).strokeDasharray }));
    expect(estilo.anim).toBe("none");
    expect(estilo.dash).toBe("none");
    await ctx.close();
  });

  test("con prefers-reduced-motion nada de la portada se anima y todo el contenido es visible", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    const r = await page.evaluate(() => ({
      animados: [...document.querySelectorAll("*")].filter((el) => getComputedStyle(el).animationName !== "none").length,
      ocultos: [...document.querySelectorAll(".revelar")].filter((el) => getComputedStyle(el).opacity !== "1").length,
    }));
    expect(r).toEqual({ animados: 0, ocultos: 0 });
    await ctx.close();
  });
});

test.describe("páginas públicas", () => {
  for (const ruta of PUBLICAS) {
    test(`${ruta} no tiene desplazamiento horizontal y tiene un solo h1`, async ({ page }) => {
      await page.goto(ruta);
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(desborde).toBeLessThanOrEqual(0);
      await expect(page.locator("h1")).toHaveCount(1);
    });
  }

  test("los premios sin confirmar se muestran como 'Por anunciar'", async ({ page }) => {
    await page.goto("/");
    const fila = page.getByRole("region", { name: "Premios" }).getByRole("listitem").filter({ hasText: "1er lugar general" });
    await expect(fila).toContainText("Por anunciar");
    await expect(page.getByText("[POR CONFIRMAR]")).toHaveCount(0);
  });

  test("la guía tiene índice con anclas que llevan a su sección", async ({ page }) => {
    await page.goto("/rubrica");
    const indice = page.getByRole("navigation", { name: "Contenido de esta guía" });
    const enlace = indice.getByRole("link", { name: "5. Normalización entre salas" }).filter({ visible: true });
    if ((await enlace.count()) === 0) await indice.getByText("Contenido de esta guía").click();
    await enlace.first().click();
    await expect(page).toHaveURL(/#5-normalizaci(ó|%C3%B3)n-entre-salas$/);
    await expect(page.getByRole("heading", { name: "5. Normalización entre salas" })).toBeInViewport();
  });

  test("la guía no publica notas internas ni corchetes pendientes", async ({ page }) => {
    await page.goto("/guia");
    const texto = await page.locator("article").innerText();
    expect(texto).not.toMatch(/\[CONFIRMAR|\[MONTO|Alerta de calendario|Decisiones pendientes/);
    expect(texto).toContain("Por anunciar");
  });
});
