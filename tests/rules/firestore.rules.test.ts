/**
 * Tests de reglas de seguridad (equivalente a los tests de RLS del prompt, Fase 1).
 * Se ejecutan contra el emulador de Firestore: `npm run test:rules`.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-edutech-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env.cleanup();
});

// Escenario: dos equipos en salas distintas, dos jueces en sala-1, uno en sala-2, staff con roles.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "participants/ana"), { nombres: "Ana", teamId: "equipo-a", categoria: "OPEN" });
    await setDoc(doc(db, "participants/beto"), { nombres: "Beto", teamId: "equipo-b", categoria: "JUNIOR" });
    await setDoc(doc(db, "participants/solo"), { nombres: "Sol", teamId: null, categoria: "OPEN" });
    await setDoc(doc(db, "teams/equipo-a"), { nombre: "Equipo A", track: "T1", roomId: "sala-1" });
    await setDoc(doc(db, "teams/equipo-b"), { nombre: "Equipo B", track: "T3", roomId: "sala-2" });
    await setDoc(doc(db, "team_members/equipo-a_ana"), { teamId: "equipo-a", participantId: "ana" });
    await setDoc(doc(db, "team_members/equipo-b_beto"), { teamId: "equipo-b", participantId: "beto" });
    await setDoc(doc(db, "repositories/equipo-b"), { teamId: "equipo-b", url: "https://github.com/x/y" });
    await setDoc(doc(db, "guardians/beto"), { participantId: "beto", documento: "SINTETICO" });

    await setDoc(doc(db, "judges/juez1"), { nombre: "Juez 1", roomId: "sala-1" });
    await setDoc(doc(db, "judges/juez2"), { nombre: "Juez 2", roomId: "sala-1" });
    await setDoc(doc(db, "judges/juez3"), { nombre: "Juez 3", roomId: "sala-2" });
    await setDoc(doc(db, "scores/semifinal_juez1_equipo-a"), { judgeId: "juez1", teamId: "equipo-a", roomId: "sala-1", ronda: "semifinal" });
    await setDoc(doc(db, "scores/semifinal_juez2_equipo-a"), { judgeId: "juez2", teamId: "equipo-a", roomId: "sala-1", ronda: "semifinal" });

    await setDoc(doc(db, "staff/admin1"), { roles: ["admin"] });
    await setDoc(doc(db, "staff/comite1"), { roles: ["comite"] });
    await setDoc(doc(db, "staff/tecnica1"), { roles: ["mesa_tecnica"] });
    await setDoc(doc(db, "staff/checkin1"), { roles: ["checkin"] });
    await setDoc(doc(db, "audit_log/1"), { accion: "x" });
    await setDoc(doc(db, "results/equipo-a"), { teamId: "equipo-a", publicado: false });
    await setDoc(doc(db, "invitations/equipo-a_x"), { teamId: "equipo-a", email: "x@edutech.test" });
    await setDoc(doc(db, "event_outbox/e1"), { type: "registration.created", payload: { email: "x@edutech.test" } });
    await setDoc(doc(db, "stats/inscripciones"), { personas: 1 });
    await setDoc(doc(db, "data_requests/ana_eliminacion"), { participantId: "ana" });
    await setDoc(doc(db, "registration_drafts/ana"), { paso: 2 });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe("participantes", () => {
  it("leen su propio equipo", async () => {
    await assertSucceeds(getDoc(doc(as("ana"), "teams/equipo-a")));
  });

  it("NO leen otro equipo ni sus datos", async () => {
    await assertFails(getDoc(doc(as("ana"), "teams/equipo-b")));
    await assertFails(getDoc(doc(as("ana"), "repositories/equipo-b")));
    await assertFails(getDoc(doc(as("ana"), "team_members/equipo-b_beto")));
    await assertFails(getDocs(query(collection(as("ana"), "team_members"), where("teamId", "==", "equipo-b"))));
  });

  it("listan solo los integrantes de su equipo", async () => {
    await assertSucceeds(getDocs(query(collection(as("ana"), "team_members"), where("teamId", "==", "equipo-a"))));
  });

  it("NO leen el perfil de otra persona", async () => {
    await assertSucceeds(getDoc(doc(as("ana"), "participants/ana")));
    await assertFails(getDoc(doc(as("ana"), "participants/beto")));
  });

  it("sin equipo no leen ningún equipo", async () => {
    await assertFails(getDoc(doc(as("solo"), "teams/equipo-a")));
  });

  it("no ven su resultado hasta que se publica", async () => {
    await assertFails(getDoc(doc(as("ana"), "results/equipo-a")));
  });

  it("NO escriben desde el cliente, ni siquiera su propio perfil", async () => {
    await assertFails(setDoc(doc(as("ana"), "participants/ana"), { nombres: "Hack" }, { merge: true }));
    await assertFails(setDoc(doc(as("ana"), "teams/equipo-a"), { track: "T2" }, { merge: true }));
  });

  it("anónimos no leen datos privados", async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "participants/ana")));
    await assertFails(getDoc(doc(anon, "teams/equipo-a")));
  });
});

describe("colecciones internas", () => {
  it("invitaciones, outbox de eventos, contadores y solicitudes LOPDP no se leen desde el cliente", async () => {
    for (const ruta of ["invitations/equipo-a_x", "event_outbox/e1", "stats/inscripciones", "data_requests/ana_eliminacion"]) {
      await assertFails(getDoc(doc(as("ana"), ruta)));
      await assertFails(getDoc(doc(as("admin1"), ruta)));
    }
  });

  it("el borrador de inscripción solo lo lee su dueño", async () => {
    await assertSucceeds(getDoc(doc(as("ana"), "registration_drafts/ana")));
    await assertFails(getDoc(doc(as("beto"), "registration_drafts/ana")));
  });
});

describe("jurado", () => {
  it("lee sus propios puntajes", async () => {
    await assertSucceeds(getDoc(doc(as("juez1"), "scores/semifinal_juez1_equipo-a")));
    await assertSucceeds(getDocs(query(collection(as("juez1"), "scores"), where("judgeId", "==", "juez1"))));
  });

  it("NO ve puntajes de otro juez, aunque sea de su misma sala", async () => {
    await assertFails(getDoc(doc(as("juez1"), "scores/semifinal_juez2_equipo-a")));
    await assertFails(getDocs(query(collection(as("juez1"), "scores"), where("teamId", "==", "equipo-a"))));
  });

  it("ve solo los equipos de su sala", async () => {
    await assertSucceeds(getDoc(doc(as("juez1"), "teams/equipo-a")));
    await assertFails(getDoc(doc(as("juez1"), "teams/equipo-b")));
    await assertSucceeds(getDoc(doc(as("juez3"), "repositories/equipo-b")));
  });

  it("NO escribe puntajes desde el cliente (pasan por el servidor con bloqueo por sala)", async () => {
    await assertFails(setDoc(doc(as("juez1"), "scores/semifinal_juez1_equipo-a"), { c1: 5 }, { merge: true }));
  });
});

describe("staff", () => {
  it("datos de representantes solo para admin y comite", async () => {
    await assertSucceeds(getDoc(doc(as("admin1"), "guardians/beto")));
    await assertSucceeds(getDoc(doc(as("comite1"), "guardians/beto")));
    await assertFails(getDoc(doc(as("tecnica1"), "guardians/beto")));
    await assertFails(getDoc(doc(as("checkin1"), "guardians/beto")));
    await assertFails(getDoc(doc(as("beto"), "guardians/beto")));
  });

  it("la mesa técnica no ve puntajes; el comité sí", async () => {
    await assertFails(getDoc(doc(as("tecnica1"), "scores/semifinal_juez1_equipo-a")));
    await assertSucceeds(getDoc(doc(as("comite1"), "scores/semifinal_juez1_equipo-a")));
  });

  it("auditoría solo para admin y comite", async () => {
    await assertSucceeds(getDoc(doc(as("comite1"), "audit_log/1")));
    await assertFails(getDoc(doc(as("tecnica1"), "audit_log/1")));
  });

  it("check-in lee participantes pero no puntajes", async () => {
    await assertSucceeds(getDoc(doc(as("checkin1"), "participants/ana")));
    await assertFails(getDoc(doc(as("checkin1"), "scores/semifinal_juez1_equipo-a")));
  });

  it("un participante no puede leer la lista de staff de otros", async () => {
    await assertFails(getDoc(doc(as("ana"), "staff/admin1")));
    await assertSucceeds(getDoc(doc(as("admin1"), "staff/comite1")));
  });
});
