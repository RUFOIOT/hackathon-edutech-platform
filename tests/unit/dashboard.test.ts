import { describe, expect, it } from "vitest";
import { aCsv } from "@/lib/dashboard/dataset";
import { calcularKpis, semaforo, type Dataset, type EntradaSemaforo } from "@/lib/dashboard/kpis";

const ec = (s: string) => new Date(`${s}-05:00`);
const fechas = { kickoff: ec("2026-11-06T15:30:00"), freeze: ec("2026-11-07T12:00:00") };
const sano: EntradaSemaforo = {
  repoRegistrado: true,
  checkpoint1: "cumplido",
  checkpoint2: "pendiente",
  admisibilidad: null,
  ultimoCommitAt: ec("2026-11-06T22:00:00"),
  autores: 3,
  commitsVentana: 12,
  mentoriaMasAntiguaSinAtender: null,
};

describe("semáforo de riesgo", () => {
  it("verde con motivo en texto cuando está al día", () => {
    expect(semaforo(sano, ec("2026-11-06T23:00:00"), fechas)).toEqual({ color: "verde", motivos: ["Al día"] });
  });

  it("rojo sin repositorio 2 h después del kick-off (no antes)", () => {
    const sinRepo = { ...sano, repoRegistrado: false, commitsVentana: 0, autores: 0, ultimoCommitAt: null };
    expect(semaforo(sinRepo, ec("2026-11-06T17:00:00"), fechas).color).toBe("verde");
    expect(semaforo(sinRepo, ec("2026-11-06T17:31:00"), fechas)).toMatchObject({ color: "rojo", motivos: ["Sin repositorio 2 h después del kick-off"] });
  });

  it("rojo por checkpoint vencido o falla de admisibilidad (incluida A4 decidida por la mesa técnica)", () => {
    expect(semaforo({ ...sano, checkpoint1: "vencido" }, ec("2026-11-06T20:00:00"), fechas).motivos).toContain("Checkpoint 1 vencido");
    const adm = { a1: true, a2: false, a3: true, a4: false, a5: true };
    expect(semaforo({ ...sano, admisibilidad: adm }, ec("2026-11-07T12:30:00"), fechas).motivos[0]).toBe("Falla de admisibilidad: A2, A4");
  });

  it("ámbar: sin commits en 3 h dentro de la ventana, un solo autor o mentoría esperando > 30 min", () => {
    const r = semaforo(
      { ...sano, ultimoCommitAt: ec("2026-11-06T19:00:00"), autores: 1, mentoriaMasAntiguaSinAtender: ec("2026-11-06T22:20:00") },
      ec("2026-11-06T23:00:00"),
      fechas,
    );
    expect(r.color).toBe("ambar");
    expect(r.motivos).toEqual(["Sin commits en las últimas 3 h", "Un solo autor en los commits", "Mentoría pedida sin atender hace más de 30 min"]);
  });

  it("fuera de la ventana no alerta por falta de commits", () => {
    expect(semaforo({ ...sano, ultimoCommitAt: ec("2026-11-07T09:00:00") }, ec("2026-11-07T15:00:00"), fechas).color).toBe("verde");
  });
});

const vacio: Dataset = {
  participantes: [],
  equipos: [],
  repos_snapshot: [],
  entregas: [],
  puntajes: [],
  kpis_por_hora: [],
  commits_por_hora: [],
  mentorias: [],
  presentaciones: [],
  jueces: [],
};

describe("KPIs desde el dataset plano", () => {
  const base = { en_lista_espera: 0, checkin_sabado: 0, autorizacion_estado: null };
  const d: Dataset = {
    ...vacio,
    participantes: [
      { ...base, participant_id: "p1", team_id: "a", categoria: "OPEN", fecha_inscripcion_dia: "2026-10-10", nivel_desarrollo: 4, nivel_n8n: 2, nivel_ia: 3, nivel_diseno: 1, rol_preferido: "construccion", checkin_viernes: 1 },
      { ...base, participant_id: "p2", team_id: "a", categoria: "JUNIOR", fecha_inscripcion_dia: "2026-10-10", nivel_desarrollo: 2, nivel_n8n: 4, nivel_ia: 1, nivel_diseno: 3, rol_preferido: "pitch", checkin_viernes: 0, autorizacion_estado: "pendiente" },
      { ...base, participant_id: "p3", team_id: null, categoria: "OPEN", fecha_inscripcion_dia: "2026-10-12", nivel_desarrollo: 1, nivel_n8n: 1, nivel_ia: 1, nivel_diseno: 1, rol_preferido: "producto", checkin_viernes: 0 },
      { participant_id: "p4", team_id: null, categoria: "OPEN", en_lista_espera: 1, fecha_inscripcion_dia: "2026-10-29" },
    ],
    equipos: [
      {
        team_id: "a",
        nombre: "A",
        track: "T1",
        estado: "completo",
        miembros: 2,
        presentes: 1,
        repo_registrado: 1,
        checkpoint1: "cumplido",
        checkpoint2: "pendiente",
        autores: 2,
        a1: 1,
        a2: 1,
        a3: 0,
        a4: null,
        a5: 1,
        semaforo: "rojo",
      },
    ],
    mentorias: [
      { tema: "n8n", estado: "atendida", minutos_espera: 10 },
      { tema: "n8n", estado: "atendida", minutos_espera: 20 },
      { tema: "pitch", estado: "abierta", minutos_espera: null },
    ],
  };
  const k = calcularKpis(d, { cupoPersonas: 150 });

  it("convocatoria: inscritos sin lista de espera, sin equipo, ocupación y pendientes Junior", () => {
    expect(k.convocatoria).toMatchObject({
      inscritosTotales: 3,
      listaEspera: 1,
      individualesSinEquipo: 1,
      ocupacionCupoPct: 2,
      autorizacionesJuniorPendientes: 1,
      equiposCompletos: 1,
    });
    expect(k.convocatoria.inscripcionesPorDia).toEqual([
      { dia: "2026-10-10", n: 2 },
      { dia: "2026-10-12", n: 1 },
    ]);
  });

  it("perfil técnico: promedios por equipo, roles cubiertos y detección de equipo sin construcción", () => {
    expect(k.perfil.heatmap[0]).toMatchObject({ desarrollo: 3, n8n: 3, rolesCubiertos: ["construccion", "pitch"], sinConstruccion: false });
  });

  it("check-in, mentoría y admisibilidad", () => {
    expect(k.checkin).toMatchObject({ presentes: 1, equiposConMenosDe2: 1 });
    expect(k.mentoria).toMatchObject({
      abiertas: 1,
      tiempoMedioAtencionMin: 15,
      temas: [
        { tema: "n8n", n: 2 },
        { tema: "pitch", n: 1 },
      ],
    });
    expect(k.entregas.admisibilidad[0]).toMatchObject({ a3: false, a4: null });
    expect(k.semaforo).toEqual({ rojo: 1, ambar: 0, verde: 0 });
  });
});

describe("CSV", () => {
  it("escapa comas y comillas, agrega BOM y neutraliza fórmulas", () => {
    const csv = aCsv([{ a: 'x,"y"', b: "=HYPERLINK(1)", c: null, d: -3 }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"x,""y"""');
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain(",,-3"); // los números negativos no se alteran
  });
});
