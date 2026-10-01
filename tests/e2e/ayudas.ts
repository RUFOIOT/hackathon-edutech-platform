import { expect, type Browser, type Page } from "@playwright/test";

/** Ayudas compartidas por los tests e2e que necesitan sesión (emuladores + servidor simulado). */

export const EMULADOR_AUTH = "http://127.0.0.1:9099";
export const SIMULADO = "http://127.0.0.1:3999";

export const correoUnico = (etiqueta: string) => `e2e-${etiqueta}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@edutech.test`;

export interface EventoRecibido {
  ruta: string;
  firmaValida: boolean;
  evento: { type: string; payload: Record<string, unknown> } | null;
}

export async function eventosDe(filtro: (e: EventoRecibido) => boolean): Promise<EventoRecibido[]> {
  const res = await fetch(`${SIMULADO}/eventos`);
  return ((await res.json()) as EventoRecibido[]).filter(filtro);
}

/** Inicia sesión con enlace mágico usando el emulador de Auth (el enlace no se envía por correo). */
export async function ingresar(page: Page, email: string, desde = "/registro") {
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
export const alerta = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

export async function continuar(page: Page, siguientePaso: string) {
  await page.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(page.getByRole("heading", { level: 2 })).toContainText(siguientePaso);
}

export async function paso2(page: Page, o: { nacimiento: string; github?: string; nivel?: string }) {
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

export async function paso3(page: Page) {
  await page.getByRole("radio", { name: /^Construcción/ }).check();
  for (const area of ["Desarrollo", "n8n", "IA", "Diseño"]) {
    await page.getByRole("group", { name: `Tu nivel en ${area}` }).getByRole("radio", { name: /^Nivel 2/ }).check();
  }
  await page.getByRole("checkbox", { name: "TypeScript" }).check();
}

export async function aceptarConsentimientos(page: Page) {
  await page.getByRole("checkbox", { name: /Acepto: reglas/ }).check();
  await page.getByRole("checkbox", { name: /Acepto: tratamiento de datos/ }).check();
}

/** Pasos 3 a 5 de un equipo y confirmación; devuelve el código de invitación. */
export async function terminarEquipo(page: Page, opciones: { invitado: string; nombre: string }) {
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
export async function inscribirEquipo(browser: Browser, opciones: { email: string; invitado: string; nombre: string }) {
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

