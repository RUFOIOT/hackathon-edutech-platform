/**
 * Verificación de aceptación de la Fase 6: cada KPI del dashboard es verificable con SQL.
 *
 * 1. Construye el dataset plano desde los emuladores (con el seed cargado), igual que /admin.
 * 2. Calcula los KPIs con lib/dashboard/kpis.ts (lo que muestra el dashboard).
 * 3. Exporta cada hoja a CSV, la carga en sqlite3 y ejecuta las consultas de docs/kpis.sql.
 * 4. Compara valor por valor y falla si alguno difiere.
 *
 * Uso: con emuladores y seed (`npm run emulators` + `npm run seed`): `npm run dataset:verificar`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { aCsv, construirDataset, CUPO_PERSONAS } from "../lib/dashboard/dataset";
import { calcularKpis } from "../lib/dashboard/kpis";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
if (!/^(127\.0\.0\.1|localhost)/.test(process.env.FIRESTORE_EMULATOR_HOST)) throw new Error("Solo contra emuladores locales.");

const AHORA = new Date(process.env.APP_FECHA_SIMULADA ?? "2026-11-07T11:00:00-05:00");

function valorEn(obj: unknown, ruta: string): unknown {
  return ruta.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

async function main() {
  const db = getFirestore(initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-edutech" }));
  const dataset = await construirDataset(db, { ahora: AHORA, conContacto: false, conPuntajes: true });
  const kpis = calcularKpis(dataset, { cupoPersonas: CUPO_PERSONAS });

  const dir = mkdtempSync(path.join(tmpdir(), "edutech-kpis-"));
  const base = path.join(dir, "dataset.sqlite");
  const comandos: string[] = [".mode csv"];
  for (const [hoja, filas] of Object.entries(dataset)) {
    if (!filas.length) continue;
    const csv = path.join(dir, `${hoja}.csv`);
    writeFileSync(csv, aCsv(filas).replace(/^﻿/, "")); // sqlite3 no espera BOM
    comandos.push(`.import ${csv} ${hoja}`);
  }
  execFileSync("sqlite3", [base], { input: comandos.join("\n") });

  const sql = readFileSync(path.join(process.cwd(), "docs/kpis.sql"), "utf8");
  const bloques = [...sql.matchAll(/^-- kpi: (\S+)\n([\s\S]*?;)/gm)];
  let fallos = 0;
  console.log(`    ${"KPI".padEnd(48)} dashboard   SQL`);
  for (const [, ruta, consulta] of bloques) {
    const esperado = valorEn(kpis, ruta!);
    const salida = execFileSync("sqlite3", [base, consulta!.trim()]).toString().trim();
    const ok = Number(salida || 0) === Number(esperado ?? 0);
    if (!ok) fallos++;
    console.log(`${ok ? "OK " : "ERR"} ${ruta!.padEnd(48)} ${String(esperado).padStart(9)}   ${salida}`);
  }
  console.log(`\n${bloques.length - fallos}/${bloques.length} KPIs coinciden con su consulta SQL (corte: ${AHORA.toISOString()}).`);
  if (fallos) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
