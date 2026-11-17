import { expect, test } from "@playwright/test";
import { AGENDA, PREMIOS } from "../../config/event";

const PUBLICAS = ["/", "/tracks", "/guia", "/guia-hacker", "/rubrica", "/privacidad"];

test.describe("cuenta regresiva", () => {
  test("muestra el tiempo correcto al kick-off en hora de Ecuador, aunque el navegador esté en otra zona", async ({ browser }) => {
    // Navegador en Tokio: el resultado debe ser el mismo porque es una resta de instantes.
    const ctx = await browser.newContext({ timezoneId: "Asia/Tokyo", viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    // 1 oct 2026 09:00 en Ecuador → faltan 57 días y 08:00:00.
    await page.clock.setFixedTime(new Date("2026-10-01T09:00:00-05:00"));
    await page.goto("/");
    const timer = page.getByRole("timer");
    await expect(timer).toContainText("27 de noviembre, 17:00 (hora de Ecuador)");
    await expect(timer).toContainText("57");
    await expect(timer).toContainText("08:00:00");
    await expect(timer).toContainText("Faltan 57 días, 8 horas y 0 minutos para el kick-off.");
    await ctx.close();
  });

  test("después del kick-off indica que el hackathon está en marcha", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-27T17:30:00-05:00"));
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

  test("los premios confirmados se muestran con su alcance y sus beneficios", async ({ page }) => {
    await page.goto("/");
    const region = page.getByRole("region", { name: "Premios" });
    // Los valores salen de config/event.ts: el test no fija montos por su cuenta.
    for (const p of PREMIOS) {
      const tarjeta = region.getByRole("listitem").filter({ hasText: p.premio }).first();
      await expect(tarjeta).toContainText(p.alcance);
      for (const b of p.beneficios) await expect(tarjeta).toContainText(b);
    }
    await expect(region).not.toContainText("Por anunciar");
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

test.describe("encabezado", () => {
  test("queda fijo arriba y las anclas de la portada no dejan el título debajo", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Secciones de esta página" }).getByRole("link", { name: "Agenda" }).click();
    await expect(page).toHaveURL(/#agenda$/);
    const titulo = page.getByRole("heading", { name: "Agenda", exact: true });
    await expect(titulo).toBeInViewport();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const header = document.querySelector("header")!.getBoundingClientRect();
          return { arriba: header.top, libre: document.getElementById("agenda")!.getBoundingClientRect().top >= header.bottom };
        }),
      )
      .toEqual({ arriba: 0, libre: true });
    await expect(page.getByRole("navigation", { name: "Secciones de esta página" }).getByRole("link", { name: "Agenda" })).toHaveAttribute("aria-current", "location");
  });

  test("en pantallas angostas el menú se abre con el botón y se cierra con Escape", async ({ page }) => {
    await page.goto("/tracks");
    const boton = page.getByRole("button", { name: "Menú", exact: true });
    test.skip(!(await boton.isVisible()), "En escritorio los enlaces están a la vista.");
    const enlace = page.locator("#menu-principal").getByRole("link", { name: "Rúbrica" });
    await expect(enlace).toBeHidden();
    await boton.click();
    await expect(enlace).toBeVisible();
    await expect(boton).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(enlace).toBeHidden();
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await boton.click();
    await enlace.click();
    await expect(page).toHaveURL(/\/rubrica$/);
    await expect(enlace).toBeHidden();
  });
});

test.describe("revelado", () => {
  test("sin JavaScript todo el contenido de la portada es visible", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    const ocultos = await page.locator(".revelar, .revelar > *").evaluateAll((els) => els.filter((el) => getComputedStyle(el).opacity !== "1").length);
    expect(ocultos).toBe(0);
    await ctx.close();
  });

  test("con JavaScript el contenido se revela al llegar a él", async ({ page }) => {
    await page.goto("/");
    const titulo = page.getByRole("region", { name: "Premios" }).locator(".revelar").first();
    await expect(titulo).toHaveCSS("opacity", "0");
    await titulo.scrollIntoViewIfNeeded();
    await expect(titulo).toHaveCSS("opacity", "1");
  });
});

test.describe("agenda en vivo", () => {
  test("fuera del evento no resalta ningún bloque", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-20T10:00:00-05:00"));
    await page.goto("/");
    const agenda = page.getByRole("region", { name: "Agenda" });
    await expect(agenda.getByRole("listitem")).toHaveCount(AGENDA.length);
    await expect(agenda.locator('[aria-current="time"]')).toHaveCount(0);
    await expect(agenda.getByText("Ahora", { exact: true })).toHaveCount(0);
  });

  test("durante el evento marca el bloque actual y el siguiente, aunque el navegador esté en otra zona", async ({ browser }) => {
    const ctx = await browser.newContext({ timezoneId: "Asia/Tokyo" });
    const page = await ctx.newPage();
    // Viernes 27 a las 17:10 de Ecuador: corre el kick-off (17:00) y sigue la mentoría (17:45).
    await page.clock.setFixedTime(new Date("2026-11-27T17:10:00-05:00"));
    await page.goto("/");
    const agenda = page.getByRole("region", { name: "Agenda" });
    const actual = agenda.locator('[aria-current="time"]');
    await expect(actual).toHaveCount(1);
    await expect(actual).toContainText("17:00");
    await expect(actual).toContainText("Ahora");
    await expect(agenda.getByRole("listitem").filter({ hasText: "Sigue" })).toContainText("17:45");
    await ctx.close();
  });
});
