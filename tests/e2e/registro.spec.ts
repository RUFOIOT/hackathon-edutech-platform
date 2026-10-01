import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Registro (Fase 3): los tres modos de inscripción, el bloqueo de menores de 14, el progreso
 * guardado en el servidor y el evento registration.created firmado que recibe "n8n" (simulado).
 * Requiere los emuladores de Firebase y el servidor simulado (ver playwright.config.ts).
 */

const EMULADOR_AUTH = "http://127.0.0.1:9099";
const SIMULADO = "http://127.0.0.1:3999";

const correoUnico = (etiqueta: string) => `e2e-${etiqueta}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@edutech.test`;

interface EventoRecibido {
  ruta: string;
  firmaValida: boolean;
  evento: { type: string; payload: Record<string, unknown> } | null;
}

async function eventosDe(filtro: (e: EventoRecibido) => boolean): Promise<EventoRecibido[]> {
  const res = await fetch(`${SIMULADO}/eventos`);
  return ((await res.json()) as EventoRecibido[]).filter(filtro);
}

/** Inicia sesión con enlace mágico usando el emulador de Auth (el enlace no se envía por correo). */
async function ingresar(page: Page, email: string, desde = "/registro") {
  await page.goto(desde);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  await expect(page.getByRole("status")).toContainText("Enlace enviado");
  const res = await fetch(`${EMULADOR_AUTH}/emulator/v1/projects/demo-edutech/oobCodes`);
  const { oobCodes } = (await res.json()) as { oobCodes: { email: string; oobLink: string; oobCode: string }[] };
  const codigo = oobCodes.filter((c) => c.email === email).at(-1);
  expect(codigo, "el emulador generó el enlace").toBeTruthy();
  const destino = new URL(new URL(codigo!.oobLink).searchParams.get("continueUrl")!);
  destino.searchParams.set("apiKey", "demo-api-key");
  destino.searchParams.set("oobCode", codigo!.oobCode);
  destino.searchParams.set("mode", "signIn");
  await page.goto(destino.toString());
  await expect(page.getByRole("heading", { name: "Inscripción", level: 1 })).toBeVisible();
}

/** Avisos de error de la app (excluye el anunciador de rutas de Next.js, que también es role=alert). */
const alerta = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

async function continuar(page: Page, siguientePaso: string) {
  await page.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(page.getByRole("heading", { level: 2 })).toContainText(siguientePaso);
}

async function paso2(page: Page, o: { nacimiento: string; github?: string; nivel?: string }) {
  await page.getByLabel("Nombres", { exact: true }).fill("Prueba");
  await page.getByLabel("Apellidos", { exact: true }).fill("Automatizada");
  await page.getByLabel("Celular", { exact: true }).fill("0991234567");
  await page.getByLabel("Fecha de nacimiento").fill(o.nacimiento);
  await page.getByLabel("Ciudad").fill("Quito");
  await page.getByLabel("Institución u organización").fill("Institución Demo");
  await page.getByLabel("Nivel", { exact: true }).selectOption(o.nivel ?? "universidad");
  await page.getByLabel("Talla de camiseta").selectOption("M");
  await page.getByLabel("Usuario de GitHub").fill(o.github ?? "demo-usuario");
}

async function paso3(page: Page) {
  await page.getByRole("radio", { name: /^Construcción/ }).check();
  for (const area of ["Desarrollo", "n8n", "IA", "Diseño"]) {
    await page.getByRole("group", { name: `Tu nivel en ${area}` }).getByRole("radio", { name: /^Nivel 2/ }).check();
  }
  await page.getByRole("checkbox", { name: "TypeScript" }).check();
}

async function aceptarConsentimientos(page: Page) {
  await page.getByRole("checkbox", { name: /Acepto: reglas/ }).check();
  await page.getByRole("checkbox", { name: /Acepto: tratamiento de datos/ }).check();
}

/** Pasos 3 a 5 de un equipo y confirmación; devuelve el código de invitación. */
async function terminarEquipo(page: Page, opciones: { invitado: string; nombre: string }) {
  await paso3(page);
  await continuar(page, "Equipo y track");
  await page.getByLabel("Nombre del equipo").fill(opciones.nombre);
  await page.getByRole("radio", { name: /^T3/ }).check();
  await page.getByLabel("Problema candidato").fill("Las matrículas toman tres días de filas en la secretaría del colegio.");
  await page.getByLabel("Integrante 2").fill(opciones.invitado);
  await continuar(page, "Consentimientos");
  await aceptarConsentimientos(page);
  await page.getByRole("button", { name: "Inscribir a mi equipo" }).click();
  await expect(page).toHaveURL(/\/mi-equipo\?inscrito=1/);
  await expect(page.getByRole("status").first()).toContainText("Equipo inscrito");
  return (await page.locator("dd.font-mono").innerText()).trim();
}

/** Inscribe un equipo completo desde cero y devuelve su código de invitación. */
async function inscribirEquipo(browser: Browser, opciones: { email: string; invitado: string; nombre: string }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await ingresar(page, opciones.email);
  await page.getByRole("radio", { name: /Inscribir a mi equipo/ }).check();
  await continuar(page, "Datos personales");
  await paso2(page, { nacimiento: "1998-03-15" });
  await continuar(page, "Perfil técnico");
  const codigo = await terminarEquipo(page, opciones);
  return { ctx, page, codigo };
}

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
