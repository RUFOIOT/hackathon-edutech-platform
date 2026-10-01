import { describe, expect, it } from "vitest";
import {
  calcularPremios,
  puntajeEquipo,
  rankingFinal,
  roomNormalization,
  scoreTotal,
  seleccionarFinalistas,
  tiebreak,
  type PuntajeJuez,
  type ResultadoEquipo,
} from "@/lib/scoring";

const pj = (judgeId: string, teamId: string, n: [number, number, number, number, number, number], tiempo = 600): PuntajeJuez => ({
  judgeId,
  teamId,
  c1: n[0],
  c2: n[1],
  c3: n[2],
  c4: n[3],
  c5: n[4],
  c6: n[5],
  tiempoUsadoSeg: tiempo,
});

const res = (teamId: string, roomId: string, puntaje: number, extra: Partial<ResultadoEquipo> = {}): ResultadoEquipo => ({
  teamId,
  roomId,
  puntaje,
  jueces: 3,
  promedioC1: 3,
  promedioC2: 3,
  promedioC4: 3,
  promedioC5: 3,
  tiempoPromedioSeg: 600,
  ...extra,
});

describe("scoreTotal (score_total)", () => {
  it("ejemplo de la rúbrica §4: C1=4, C2=5, C3=3, C4=4, C5=3, C6=4 → 80/100", () => {
    expect(scoreTotal({ c1: 4, c2: 5, c3: 3, c4: 4, c5: 3, c6: 4 })).toBe(80);
  });

  it("todo 5 → 100; todo 1 → 20", () => {
    expect(scoreTotal({ c1: 5, c2: 5, c3: 5, c4: 5, c5: 5, c6: 5 })).toBe(100);
    expect(scoreTotal({ c1: 1, c2: 1, c3: 1, c4: 1, c5: 1, c6: 1 })).toBe(20);
  });

  it("no compensación: C2 = 1 limita el total a 60 aunque el resto sea perfecto", () => {
    // Sin la regla sería 20 + 5 + 15 + 15 + 10 + 15 = 80.
    expect(scoreTotal({ c1: 5, c2: 1, c3: 5, c4: 5, c5: 5, c6: 5 })).toBe(60);
  });

  it("C2 = 1 no sube un total que ya está por debajo de 60", () => {
    // 8 + 5 + 6 + 6 + 4 + 6 = 35
    expect(scoreTotal({ c1: 2, c2: 1, c3: 2, c4: 2, c5: 2, c6: 2 })).toBe(35);
  });

  it("C2 = 2 ya no tiene tope", () => {
    expect(scoreTotal({ c1: 5, c2: 2, c3: 5, c4: 5, c5: 5, c6: 5 })).toBe(85);
  });

  it("rechaza niveles fuera de 1–5 o no enteros", () => {
    expect(() => scoreTotal({ c1: 0, c2: 5, c3: 5, c4: 5, c5: 5, c6: 5 })).toThrow(/1 a 5/);
    expect(() => scoreTotal({ c1: 3.5, c2: 5, c3: 5, c4: 5, c5: 5, c6: 5 })).toThrow();
  });
});

describe("puntaje del equipo en la sala", () => {
  it("promedia jueces aplicando el tope de C2 por juez (D-05)", () => {
    const puntajes = [pj("j1", "a", [4, 5, 3, 4, 3, 4]), pj("j2", "a", [5, 1, 5, 5, 5, 5])];
    // j1 = 80, j2 = 60 (tope) → 70
    expect(puntajeEquipo("a", "s1", puntajes).puntaje).toBe(70);
  });

  it("excluye al juez con conflicto declarado y promedia con los restantes", () => {
    const puntajes = [pj("j1", "a", [4, 5, 3, 4, 3, 4]), pj("j2", "a", [1, 2, 1, 1, 1, 1])];
    const r = puntajeEquipo("a", "s1", puntajes, new Set(["j2_a"]));
    expect(r.puntaje).toBe(80);
    expect(r.jueces).toBe(1);
  });
});

describe("roomNormalization (room_normalization)", () => {
  it("z = (puntaje − promedio) ÷ desviación poblacional de la sala", () => {
    // Sala con 4 equipos: 60, 70, 80, 90 → media 75, σ = √125 ≈ 11.180
    const { equipos, salas } = roomNormalization([res("a", "s1", 60), res("b", "s1", 70), res("c", "s1", 80), res("d", "s1", 90)]);
    expect(salas[0]).toMatchObject({ roomId: "s1", equipos: 4, promedio: 75, desviacion: 11.18, sinNormalizar: false });
    expect(equipos.find((e) => e.teamId === "d")!.z).toBeCloseTo(1.342, 3);
    expect(equipos.find((e) => e.teamId === "a")!.z).toBeCloseTo(-1.342, 3);
  });

  it("una sala con menos de 4 equipos queda sin normalizar (z null)", () => {
    const { equipos, salas } = roomNormalization([res("a", "s2", 70), res("b", "s2", 80), res("c", "s2", 90)]);
    expect(salas[0]!.sinNormalizar).toBe(true);
    expect(equipos.every((e) => e.z === null && e.sinNormalizar)).toBe(true);
  });

  it("si todos empatan en la sala (σ = 0), z = 0", () => {
    const { equipos } = roomNormalization(["a", "b", "c", "d"].map((t) => res(t, "s1", 75)));
    expect(equipos.every((e) => e.z === 0)).toBe(true);
  });

  it("normaliza cada sala por separado: compara jurados distintos de forma justa", () => {
    // Sala dura (puntajes bajos) y sala blanda (altos): los primeros de cada una quedan con el mismo z.
    const dura = [50, 55, 60, 65].map((p, i) => res(`d${i}`, "dura", p));
    const blanda = [80, 85, 90, 95].map((p, i) => res(`b${i}`, "blanda", p));
    const { equipos } = roomNormalization([...dura, ...blanda]);
    expect(equipos.find((e) => e.teamId === "d3")!.z).toBe(equipos.find((e) => e.teamId === "b3")!.z);
  });
});

describe("tiebreak", () => {
  it("1) mayor C2", () => {
    expect(tiebreak(res("a", "s", 80, { promedioC2: 5 }), res("b", "s", 80, { promedioC2: 4 }))).toBeLessThan(0);
  });

  it("2) con C2 igual, mayor C1", () => {
    expect(tiebreak(res("a", "s", 80, { promedioC1: 3 }), res("b", "s", 80, { promedioC1: 4 }))).toBeGreaterThan(0);
  });

  it("3) con C2 y C1 iguales, menor tiempo usado", () => {
    expect(tiebreak(res("a", "s", 80, { tiempoPromedioSeg: 470 }), res("b", "s", 80, { tiempoPromedioSeg: 500 }))).toBeLessThan(0);
  });

  it("4) empate total: queda para la votación del jurado de la final", () => {
    const { empatesSinResolver } = rankingFinal([res("a", "final", 85), res("b", "final", 85), res("c", "final", 70)]);
    expect(empatesSinResolver).toEqual([["a", "b"]]);
  });

  it("el ranking final ordena por puntaje y desempata con C2", () => {
    const { orden } = rankingFinal([res("a", "final", 85, { promedioC2: 4 }), res("b", "final", 85, { promedioC2: 5 }), res("c", "final", 90)]);
    expect(orden.map((r) => r.teamId)).toEqual(["c", "b", "a"]);
  });
});

describe("finalistas", () => {
  it("top 5 por z entre salas normalizadas; avisa al comité si hay salas sin normalizar", () => {
    const s1 = [60, 70, 80, 90].map((p, i) => res(`s1-${i}`, "s1", p));
    const s2 = [50, 60, 70, 95].map((p, i) => res(`s2-${i}`, "s2", p));
    const s3 = [88, 92].map((p, i) => res(`s3-${i}`, "s3", p)); // solo 2 equipos
    const { equipos } = roomNormalization([...s1, ...s2, ...s3]);
    const p = seleccionarFinalistas(equipos);
    expect(p.finalistas).toHaveLength(5);
    expect(p.finalistas[0]).toBe("s2-3"); // el z más alto (95 en una sala de media 68.75)
    expect(p.finalistas).not.toContain("s3-1");
    expect(p).toMatchObject({ requiereDecisionComite: true, salasSinNormalizar: ["s3"] });
  });
});

describe("premios", () => {
  const semifinal = [
    res("a", "s1", 92, { promedioC4: 4 }),
    res("b", "s1", 88, { promedioC4: 5 }),
    res("c", "s2", 85, { promedioC4: 3 }),
    res("d", "s2", 80, { promedioC4: 4.5 }),
    res("e", "s3", 78, { promedioC4: 2 }),
    res("f", "s3", 70, { promedioC4: 5 }),
    res("g", "s3", 65, { promedioC4: 4 }),
  ];
  const track = { a: "T1", b: "T1", c: "T2", d: "T2", e: "T3", f: "T3", g: "T3" } as const;

  it("generales desde la final; mejor por track excluye a los 3 generales; máximo un especial por equipo", () => {
    const { premios } = calcularPremios({
      ordenFinal: ["a", "c", "e", "b", "d"],
      semifinal,
      track,
      tieneN8n: { b: true, d: true, f: true, g: true },
      esJunior: { f: true, g: true },
    });
    const de = (p: string) => premios.find((x) => x.premio === p)?.teamId;
    expect([de("1er lugar general"), de("2do lugar general"), de("3er lugar general")]).toEqual(["a", "c", "e"]);
    expect(de("Mejor solución T1")).toBe("b"); // a es general
    expect(de("Mejor solución T2")).toBe("d");
    expect(de("Mejor solución T3")).toBe("f");
    // n8n: b (C4 5) y f (C4 5) ya tienen un especial; d también → pasa al siguiente elegible, g.
    expect(de("Premio n8n a la mejor automatización")).toBe("g");
    // Junior: f y g ya tienen especial → sin ganador elegible, queda para el comité.
    expect(de("Mejor equipo Junior")).toBeNull();
  });

  it("un equipo con premio general puede recibir además un especial", () => {
    const { premios } = calcularPremios({
      ordenFinal: ["a", "c", "e"],
      semifinal,
      track,
      tieneN8n: { a: true },
      esJunior: {},
    });
    expect(premios.find((p) => p.premio.startsWith("Premio n8n"))?.teamId).toBe("a");
  });

  it("propone a la Aceleradora el top 10 ordenado por C1 + C5", () => {
    const sf = [res("x", "s1", 90, { promedioC1: 3, promedioC5: 3 }), res("y", "s1", 80, { promedioC1: 5, promedioC5: 5 })];
    const { candidatosAceleradora } = calcularPremios({ ordenFinal: ["x", "y"], semifinal: sf, track: { x: "T1", y: "T1" }, tieneN8n: {}, esJunior: {} });
    expect(candidatosAceleradora).toEqual(["y", "x"]);
  });
});
