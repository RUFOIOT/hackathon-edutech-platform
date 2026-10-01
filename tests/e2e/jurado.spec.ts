import { expect, test, type Page } from "@playwright/test";
import { adminEmulador, alerta, ingresarComo } from "./ayudas";

/**
 * Evaluación del jurado (Fase 5), en celular: lista de la sala, hoja con descriptores, regla de
 * no compensación visible, conflicto de interés y bloqueo al cerrar la sala.
 */

async function elegirNiveles(page: Page, niveles: [number, number, number, number, number, number]) {
  for (const [i, n] of niveles.entries()) {
    await page
      .getByRole("group", { name: new RegExp(`^C${i + 1} ·`) })
      .getByRole("radio", { name: new RegExp(`^Nivel ${n}`) })
      .check();
  }
}

test.describe("jurado", () => {
  test.describe.configure({ timeout: 120_000 });

  test("evalúa con descriptores, respeta el tope de C2 = 1, declara conflicto y queda bloqueado al cerrar la sala", async ({ page }) => {
    const { db, auth } = await adminEmulador();
    const sufijo = Date.now();
    const sala = `sala-e2e-${sufijo}`;
    const equipoA = `equipo-a-${sufijo}`;
    const equipoB = `equipo-b-${sufijo}`;
    const email = `juez-e2e-${sufijo}@edutech.test`;
    const juez = await auth.createUser({ email, displayName: "Juez E2E" });

    await db.doc("events/edutech-2026").set({ rondaActiva: "semifinal" }, { merge: true });
    await db.doc(`rooms/${sala}`).set({ nombre: `Sala E2E ${sufijo}`, tracks: ["T1"], cerrada: false });
    await db.doc(`judges/${juez.uid}`).set({ nombre: "Juez E2E", perfil: "tecnico", roomId: sala, final: false });
    for (const [i, teamId] of [equipoA, equipoB].entries()) {
      const nombre = `Equipo ${i ? "B" : "A"} ${sufijo}`;
      await db.doc(`teams/${teamId}`).set({ nombre, track: "T1", roomId: sala, estado: "completo" });
      await db.doc(`presentation_slots/semifinal_${sala}_${teamId}`).set({
        roomId: sala,
        teamId,
        equipo: nombre,
        track: "T1",
        ronda: "semifinal",
        orden: i + 1,
        horaProgramada: new Date(`2026-11-07T${13 + i}:30:00-05:00`),
      });
    }

    await ingresarComo(page, email, "/jurado");
    const lista = page.getByRole("list");
    await expect(lista.getByRole("link", { name: new RegExp(`Equipo A ${sufijo}.*Pendiente`) })).toBeVisible();
    await expect(lista.getByRole("link", { name: new RegExp(`Equipo B ${sufijo}.*Pendiente`) })).toBeVisible();

    // Evaluación del equipo A.
    await lista.getByRole("link", { name: new RegExp(`Equipo A ${sufijo}`) }).click();
    await page.getByRole("radio", { name: /^No$/ }).check();
    // Los descriptores de la rúbrica están visibles junto a cada nivel.
    await expect(page.getByText("El flujo principal corre en vivo de punta a punta")).toBeVisible();

    // Regla de no compensación: todo 5 con C2 = 1 → 60, con aviso explícito.
    await elegirNiveles(page, [5, 1, 5, 5, 5, 5]);
    await expect(page.getByText(/Total:\s*60\/100/)).toBeVisible();
    await expect(page.getByText("C2 = 1: el total no puede superar 60")).toBeVisible();

    // Ejemplo de la rúbrica: 4, 5, 3, 4, 3, 4 → 80.
    await elegirNiveles(page, [4, 5, 3, 4, 3, 4]);
    await expect(page.getByText(/Total:\s*80\/100/)).toBeVisible();
    // Sin demo ni fortaleza el servidor no guarda y dice qué falta.
    await page.getByRole("button", { name: "Guardar evaluación" }).click();
    await expect(alerta(page)).toContainText("Indica si la demo fue en vivo");
    await page.getByLabel("Minutos", { exact: true }).fill("7");
    await page.getByLabel("Segundos", { exact: true }).fill("45");
    await page.getByRole("radio", { name: /^En vivo/ }).check();
    await page.getByLabel("Fortaleza").fill("Problema bien acotado con evidencia de entrevistas reales.");
    await page.getByLabel("Recomendación").fill("Medir el ahorro de tiempo con un piloto de dos semanas.");
    await page.getByRole("button", { name: "Guardar evaluación" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Puntaje guardado" })).toContainText("80/100");

    const guardado = await db.doc(`scores/semifinal_${juez.uid}_${equipoA}`).get();
    expect(guardado.data()).toMatchObject({ total: 80, roomId: sala, tiempoUsadoSeg: 465, demoEnVivo: true, bloqueado: false });

    // Conflicto de interés con el equipo B.
    await page.goto("/jurado");
    await lista.getByRole("link", { name: new RegExp(`Equipo B ${sufijo}`) }).click();
    await page.getByRole("radio", { name: /^Sí, no evaluar/ }).check();
    await page.getByLabel("Motivo del conflicto").fill("Fui docente de dos integrantes este año.");
    await page.getByRole("button", { name: "Declarar conflicto" }).click();
    await expect(page.getByRole("status")).toContainText("Conflicto declarado");
    await page.goto("/jurado");
    await expect(lista.getByRole("link", { name: new RegExp(`Equipo A ${sufijo}.*Evaluado: 80/100`) })).toBeVisible();
    await expect(lista.getByRole("link", { name: new RegExp(`Equipo B ${sufijo}.*Conflicto declarado`) })).toBeVisible();

    // El comité cierra la sala: la hoja queda en solo lectura.
    await db.doc(`rooms/${sala}`).update({ cerrada: true });
    await db.doc(`scores/semifinal_${juez.uid}_${equipoA}`).update({ bloqueado: true });
    await page.goto(`/jurado/${equipoA}`);
    await expect(page.getByText("La sala está cerrada: los puntajes están bloqueados")).toBeVisible();
    await expect(page.getByRole("button", { name: /Guardar/ })).toHaveCount(0);
    await expect(page.getByRole("group", { name: /^C1 ·/ }).getByRole("radio", { name: /^Nivel 4/ })).toBeDisabled();
  });

  test("un juez no puede abrir la hoja de un equipo de otra sala", async ({ page }) => {
    const { db, auth } = await adminEmulador();
    const sufijo = Date.now();
    const email = `juez-otra-${sufijo}@edutech.test`;
    const juez = await auth.createUser({ email });
    await db.doc(`rooms/sala-x-${sufijo}`).set({ nombre: "Sala X", tracks: ["T2"], cerrada: false });
    await db.doc(`judges/${juez.uid}`).set({ nombre: "Juez X", perfil: "negocio", roomId: `sala-x-${sufijo}`, final: false });
    await db.doc(`teams/ajeno-${sufijo}`).set({ nombre: "Equipo ajeno", track: "T1", roomId: "otra-sala", estado: "completo" });
    await ingresarComo(page, email, "/jurado");
    await page.goto(`/jurado/ajeno-${sufijo}`);
    await expect(alerta(page)).toContainText("Este equipo no presenta en tu sala.");
  });

  test("la pantalla del proyector muestra el equipo y la fase del Show and Tell en tiempo real", async ({ page }) => {
    const { db } = await adminEmulador();
    const sala = `sala-pantalla-${Date.now()}`;
    const ref = db.doc(`public_state/cronometro_${sala}`);
    await ref.set({ roomId: sala, sala: "Sala de prueba", slotId: "x", equipo: "Equipo en escena", orden: 2, corriendo: false, inicioMs: null, acumuladoMs: 3 * 60_000 });
    await page.goto(`/pantalla?sala=${sala}`);
    await expect(page.getByRole("heading", { name: "Equipo en escena" })).toBeVisible();
    await expect(page.getByText("03:00")).toBeVisible();
    await expect(page.getByText("Exposición y demo en vivo")).toBeVisible();
    // Minuto 9: preguntas; minuto 12: tiempo cumplido. Llega por onSnapshot, sin recargar.
    await ref.update({ acumuladoMs: 9 * 60_000 });
    await expect(page.getByText("Preguntas del jurado")).toBeVisible();
    await ref.update({ acumuladoMs: 12 * 60_000 });
    await expect(page.getByText("Tiempo cumplido: se apaga el micrófono")).toBeVisible();
    await db.doc("public_state/pantalla").set({ aviso: "Receso de 10 minutos" }, { merge: true });
    await expect(page.getByRole("status")).toContainText("Receso de 10 minutos");
    await db.doc("public_state/pantalla").set({ aviso: null }, { merge: true });
  });
});
