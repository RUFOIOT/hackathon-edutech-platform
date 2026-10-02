import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { adminEmulador, ingresarComo } from "./ayudas";

/**
 * Operación del día del evento (Fase 6): check-in manual desde el celular, permisos por rol en el
 * panel y exportación del dataset sin datos de contacto para la mesa técnica.
 */

async function crearStaff(roles: string[], etiqueta: string) {
  const { db, auth } = await adminEmulador();
  const email = `${etiqueta}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@edutech.test`;
  const u = await auth.createUser({ email });
  await db.doc(`staff/${u.uid}`).set({ roles, nombre: etiqueta });
  return email;
}

test.describe("operación", () => {
  test.describe.configure({ timeout: 120_000 });

  test("el staff de check-in registra a una persona por búsqueda manual y no ve el resto del panel", async ({ page }) => {
    const { db } = await adminEmulador();
    const sufijo = Date.now();
    const pid = `p-e2e-checkin-${sufijo}`;
    const teamId = `equipo-checkin-${sufijo}`;
    await db.doc(`teams/${teamId}`).set({ nombre: `Checkin ${sufijo}`, track: "T1", estado: "completo" });
    await db.doc(`participants/${pid}`).set({
      nombres: "Ana",
      apellidos: `Prueba${sufijo}`,
      categoria: "OPEN",
      teamId,
      enListaEspera: false,
    });

    const email = await crearStaff(["checkin"], "checkin");
    await ingresarComo(page, email, "/admin/checkin");

    await page.getByLabel("Buscar por nombre o equipo").fill(`Prueba${sufijo}`);
    const fila = page.getByRole("listitem").filter({ hasText: `Ana Prueba${sufijo}` });
    await fila.getByRole("button", { name: "Registrar check-in" }).click();
    await expect(fila.getByText("Ya presente")).toBeVisible({ timeout: 10_000 });

    const checkins = await db.collection("checkins").where("participantId", "==", pid).get();
    expect(checkins.size).toBe(1);
    const auditoria = await db.collection("audit_log").where("entidadId", "==", checkins.docs[0]!.id).get();
    expect(auditoria.docs.map((d) => d.get("accion"))).toContain("checkin.create");

    // Solo tiene acceso al check-in.
    await page.goto("/admin/participantes");
    await expect(page).toHaveURL(/\/sin-acceso/);
  });

  test("la mesa técnica exporta el dataset sin datos de contacto ni puntajes", async ({ page }) => {
    const email = await crearStaff(["mesa_tecnica"], "mesa");
    await ingresarComo(page, email, "/admin");

    const res = await page.request.get("/api/admin/exportar?formato=csv");
    expect(res.status()).toBe(200);
    const archivos = unzipSync(new Uint8Array(await res.body()));
    expect(Object.keys(archivos)).not.toContain("puntajes.csv");
    const cabecera = strFromU8(archivos["participantes.csv"]!).split("\n")[0]!.split(",");
    for (const columna of ["nombres", "apellidos", "email", "celular"]) expect(cabecera).not.toContain(columna);
  });

  test("una persona sin rol de staff no puede exportar", async ({ page }) => {
    const res = await page.request.get("/api/admin/exportar?formato=csv");
    expect(res.status()).toBe(403);
  });

  test("las páginas llevan cabeceras de seguridad", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=(self)");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("el endpoint de sesión responde 429 al superar el límite por IP", async ({ request, baseURL }) => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
    const pedir = () =>
      request.post("/api/auth/session", { headers: { Origin: baseURL!, "X-Forwarded-For": ip }, data: { idToken: "no-es-un-token" } });
    const estados: number[] = [];
    for (let i = 0; i < 121; i++) estados.push((await pedir()).status());
    expect(estados.slice(0, 120).every((s) => s === 401)).toBe(true);
    const ultima = await pedir();
    expect(ultima.status()).toBe(429);
    expect(Number(ultima.headers()["retry-after"])).toBeGreaterThan(0);
    // Otra IP no se ve afectada.
    const otra = await request.post("/api/auth/session", { headers: { Origin: baseURL!, "X-Forwarded-For": "198.51.100.7" }, data: { idToken: "x" } });
    expect(otra.status()).toBe(401);
  });

  test("el admin atiende una solicitud de eliminación: la persona queda anonimizada y sin cuenta", async ({ page }) => {
    const { db, auth } = await adminEmulador();
    const sufijo = Date.now();
    const email = `borrar-${sufijo}@edutech.test`;
    const u = await auth.createUser({ email });
    await db.doc(`participants/${u.uid}`).set({
      nombres: "Persona",
      apellidos: `Borrable${sufijo}`,
      email,
      celular: "0999999999",
      fechaNacimiento: "2010-05-01",
      categoria: "JUNIOR",
      nivel: "colegio",
      ciudad: "Quito",
      teamId: null,
      enListaEspera: false,
    });
    await db.doc(`guardians/${u.uid}`).set({ participantId: u.uid, nombre: "Representante", documento: "1700000000", estado: "validado" });
    await db.doc(`data_requests/${u.uid}_eliminacion`).set({ participantId: u.uid, tipo: "eliminacion", estado: "pendiente" });

    const admin = await crearStaff(["admin"], "admin-privacidad");
    await ingresarComo(page, admin, "/admin/privacidad");
    const fila = page.getByRole("listitem").filter({ hasText: `Borrable${sufijo}` });
    await fila.getByRole("button", { name: "Anonimizar a Persona" }).click();
    await fila.getByRole("button", { name: "Sí, confirmar" }).click();
    // Atendida, la solicitud sale de la lista de pendientes.
    await expect(fila).toHaveCount(0, { timeout: 15_000 });

    const p = await db.doc(`participants/${u.uid}`).get();
    expect(p.get("anonimizado")).toBe(true);
    expect(p.get("email")).toBeNull();
    expect(p.get("celular")).toBeNull();
    expect(p.get("categoria")).toBe("JUNIOR");
    expect((await db.doc(`guardians/${u.uid}`).get()).exists).toBe(false);
    expect((await db.doc(`data_requests/${u.uid}_eliminacion`).get()).get("estado")).toBe("atendida");
    await expect(auth.getUser(u.uid)).rejects.toThrow();
  });
});
