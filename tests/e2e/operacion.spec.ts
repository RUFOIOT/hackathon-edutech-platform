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
});
