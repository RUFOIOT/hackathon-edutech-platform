import { expect, test } from "@playwright/test";
import { aceptarConsentimientos, alerta, continuar, correoUnico, eventosDe, ingresar, inscribirEquipo, paso2, paso3, terminarEquipo } from "./ayudas";

/**
 * Registro (Fase 3): los tres modos de inscripción, el bloqueo de menores de 14, el progreso
 * guardado en el servidor y el evento registration.created firmado que recibe "n8n" (simulado).
 * Requiere los emuladores de Firebase y el servidor simulado (ver playwright.config.ts).
 */

test.describe("registro", () => {
  // Cada test recorre el formulario completo (a veces dos veces): más margen que el global.
  test.describe.configure({ timeout: 120_000 });

  test("inscribir equipo completo: progreso guardado, invitaciones y registration.created firmado", async ({ browser }) => {
    const email = correoUnico("capitan");
    const invitado = correoUnico("invitado");
    const nombre = `Equipo E2E ${Date.now()}`;

    // Valida GitHub contra el simulado y comprueba que el progreso persiste al recargar.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await ingresar(page, email);
    await page.getByRole("radio", { name: /Inscribir a mi equipo/ }).check();
    await continuar(page, "Datos personales");
    await paso2(page, { nacimiento: "1998-03-15", github: "no-existe-nadie" });
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(alerta(page)).toContainText("No encontramos el usuario no-existe-nadie en GitHub");
    await page.getByLabel("Usuario de GitHub").fill("demo-capitan");
    await continuar(page, "Perfil técnico");
    await page.reload();
    await expect(page.getByRole("heading", { level: 2 })).toContainText("Paso 3 de 5: Perfil técnico");
    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page.getByLabel("Usuario de GitHub")).toHaveValue("demo-capitan");
    await ctx.close();

    // En otro navegador, con el mismo correo, el asistente retoma el borrador guardado en el servidor.
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await ingresar(p2, email);
    await expect(p2.getByRole("heading", { level: 2 })).toContainText("Paso 2 de 5: Datos personales");
    await expect(p2.getByLabel("Usuario de GitHub")).toHaveValue("demo-capitan");
    await continuar(p2, "Perfil técnico");
    const codigo = await terminarEquipo(p2, { invitado, nombre });
    await expect(p2.getByRole("heading", { name: nombre })).toBeVisible();
    await expect(p2.getByText(invitado)).toBeVisible();
    await expect(p2.getByRole("img", { name: "Tu código QR de check-in" }).locator("svg")).toBeVisible();
    expect(codigo).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    await expect
      .poll(async () => (await eventosDe((e) => e.evento?.payload.email === email)).map((e) => [e.ruta, e.firmaValida]))
      .toContainEqual(["registration.created", true]);
    const [creado] = await eventosDe((e) => e.ruta === "registration.created" && e.evento?.payload.email === email);
    expect(creado!.evento!.payload).toMatchObject({ modo: "equipo", categoria: "OPEN", teamNombre: nombre, listaEspera: false });
    await expect
      .poll(async () => (await eventosDe((e) => e.ruta === "team.invitation" && e.evento?.payload.correo === invitado && e.firmaValida)).length)
      .toBe(1);
    await ctx2.close();
  });

  test("unirse con código: el equipo pasa a completo y se emite team.completed", async ({ browser }) => {
    const invitado = correoUnico("se-une");
    const nombre = `Equipo Union ${Date.now()}`;
    const { ctx, codigo } = await inscribirEquipo(browser, { email: correoUnico("cap"), invitado, nombre });
    await ctx.close();

    const ctx2 = await browser.newContext();
    const page = await ctx2.newPage();
    await ingresar(page, invitado, `/registro?codigo=${codigo}`);
    // La invitación precarga el modo y el código.
    await expect(page.getByLabel("Código de invitación", { exact: true })).toHaveValue(codigo);
    await continuar(page, "Datos personales");
    await paso2(page, { nacimiento: "2001-07-01" });
    await continuar(page, "Perfil técnico");
    await paso3(page);
    await continuar(page, "Consentimientos");
    await expect(page.getByText(`Te unirás al equipo ${nombre}`)).toBeVisible();
    await aceptarConsentimientos(page);
    await page.getByRole("button", { name: "Confirmar mi inscripción" }).click();
    await expect(page).toHaveURL(/\/mi-equipo/);
    await expect(page.getByText("Completo (2 integrantes)")).toBeVisible();
    await expect
      .poll(async () => (await eventosDe((e) => e.ruta === "team.completed" && e.evento?.payload.teamNombre === nombre && e.firmaValida)).length)
      .toBe(1);
    await ctx2.close();
  });

  test("inscripción individual Junior: representante, autorización PDF y matchmaking", async ({ browser }) => {
    const email = correoUnico("junior");
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await ingresar(page, email);
    await page.getByRole("radio", { name: /Inscribirme y buscar equipo/ }).check();
    await continuar(page, "Datos personales");
    await paso2(page, { nacimiento: "2011-03-01", nivel: "colegio" });
    await expect(page.getByRole("status")).toContainText("Categoría Junior (15 años)");
    await continuar(page, "Perfil técnico");
    await paso3(page);
    await continuar(page, "Consentimientos");
    await expect(page.getByRole("link", { name: "Descargar la plantilla (PDF)" })).toHaveAttribute("href", "/plantilla-autorizacion.pdf");

    await aceptarConsentimientos(page);
    // Sin representante ni PDF no se puede confirmar, y los errores dicen qué falta.
    await page.getByRole("button", { name: "Confirmar mi inscripción" }).click();
    await expect(alerta(page)).toContainText("Adjunta la autorización firmada en PDF");

    await page.getByLabel("Nombre completo del representante").fill("María Representante Demo");
    await page.getByLabel("Cédula del representante").fill("1710034065");
    await page.getByLabel("Parentesco").fill("Madre");
    await page.getByLabel("Correo del representante").fill(correoUnico("rep"));
    await page.getByLabel("Celular del representante").fill("0997654321");
    await page.getByLabel("Autorización firmada (PDF, máximo 4 MB)").setInputFiles({
      name: "autorizacion.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% autorización de prueba\n%%EOF"),
    });
    await page.getByRole("button", { name: "Confirmar mi inscripción" }).click();
    await expect(page).toHaveURL(/\/mi-equipo\?inscrito=1/);
    await expect(page.getByRole("status").first()).toContainText("Inscripción confirmada");
    await expect(page.getByRole("heading", { name: "Estás en el matchmaking" })).toBeVisible();
    await expect(page.getByText("Pendiente de validación por la organización")).toBeVisible();

    await expect
      .poll(async () => (await eventosDe((e) => e.ruta === "registration.created" && e.evento?.payload.email === email)).map((e) => e.firmaValida))
      .toEqual([true]);
    const [ev] = await eventosDe((e) => e.ruta === "registration.created" && e.evento?.payload.email === email);
    expect(ev!.evento!.payload).toMatchObject({ categoria: "JUNIOR", modo: "individual", teamId: null, requiereAutorizacion: true });
    await ctx.close();
  });

  test("bloquea a menores de 14 años en el paso 2", async ({ page }) => {
    await ingresar(page, correoUnico("menor"));
    await page.getByRole("radio", { name: /Inscribirme y buscar equipo/ }).check();
    await continuar(page, "Datos personales");
    await paso2(page, { nacimiento: "2013-02-01", nivel: "colegio" });
    // Aviso inmediato en el cliente…
    await expect(page.getByRole("status")).toContainText("necesitas tener al menos 14 años");
    // …y rechazo del servidor: no avanza de paso.
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(alerta(page)).toContainText("al menos 14 años");
    await expect(page.getByRole("heading", { level: 2 })).toContainText("Datos personales");
    await expect(page.getByLabel("Fecha de nacimiento")).toHaveAttribute("aria-invalid", "true");
  });
});
