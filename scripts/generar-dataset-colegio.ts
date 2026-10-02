/**
 * Genera public/dataset-ficticio-colegio.zip: datos 100 % sintéticos de un colegio para que los
 * equipos construyan sin datos reales (guía §8 regla 4, Guía del Hacker §6).
 *
 * Determinista (semilla fija): cada ejecución produce el mismo ZIP. Incluye patrones a propósito
 * para que haya algo que descubrir: la asistencia baja se asocia con notas bajas, algunas familias
 * acumulan pensiones vencidas y hay estudiantes con necesidades educativas que requieren apoyo.
 *
 * Uso: npm run dataset:colegio
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";

type Fila = Record<string, string | number | null>;

// mulberry32: PRNG pequeño y reproducible.
let semilla = 20261106;
function azar(): number {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const elegir = <T>(xs: readonly T[]): T => xs[Math.floor(azar() * xs.length)]!;
const entre = (min: number, max: number) => min + azar() * (max - min);
const normal = (media: number, desv: number) => media + desv * Math.sqrt(-2 * Math.log(1 - azar())) * Math.cos(2 * Math.PI * azar());
const acotar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const pad = (n: number, w = 3) => String(n).padStart(w, "0");

function csv(filas: Fila[]): string {
  const cols = Object.keys(filas[0]!);
  const celda = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${cols.join(",")}\n${filas.map((f) => cols.map((c) => celda(f[c])).join(",")).join("\n")}\n`;
}

const NOMBRES = ["Ana", "Mateo", "Valentina", "Sebastián", "Camila", "Joaquín", "Isabella", "Martín", "Sofía", "Emilio", "Daniela", "Tomás", "Renata", "Nicolás", "Paula", "Andrés", "Luciana", "Gabriel", "Antonella", "Diego"];
const APELLIDOS = ["Andrade", "Benítez", "Cárdenas", "Delgado", "Espinoza", "Flores", "Guerrero", "Herrera", "Iturralde", "Jaramillo", "León", "Mora", "Navarrete", "Ordóñez", "Paredes", "Quiroga", "Rivadeneira", "Salazar", "Torres", "Vásconez"];
const CURSOS = ["8vo EGB", "9no EGB", "10mo EGB", "1ro BGU", "2do BGU", "3ro BGU"] as const;
const PARALELOS = ["A", "B"] as const;
const MATERIAS = ["Matemática", "Lengua y Literatura", "Ciencias Naturales", "Estudios Sociales", "Inglés", "Educación Física", "Educación Cultural y Artística"] as const;
const NEE = ["ninguna", "ninguna", "ninguna", "ninguna", "ninguna", "ninguna", "ninguna", "ninguna", "TDAH", "dislexia", "discalculia", "TEA", "discapacidad visual"] as const;
const BECAS = [0, 0, 0, 0, 0, 10, 25, 50] as const;
const PENSION_BASE = 185;

// --- Docentes y horarios ---
const docentes: Fila[] = MATERIAS.flatMap((m, i) =>
  [0, 1].map((j) => ({ codigo: `DOC-${pad(i * 2 + j + 1, 2)}`, nombre_ficticio: `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`, materia_principal: m })),
);
const BLOQUES = ["07:15", "08:00", "08:45", "09:30", "10:30", "11:15", "12:00"];
const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"];
const horarios: Fila[] = CURSOS.flatMap((curso) =>
  PARALELOS.flatMap((paralelo) =>
    DIAS.flatMap((dia) =>
      BLOQUES.map((inicio, b) => {
        const materia = MATERIAS[(b + DIAS.indexOf(dia) + CURSOS.indexOf(curso)) % MATERIAS.length]!;
        const [h, mi] = inicio.split(":").map(Number) as [number, number];
        const fin = new Date(Date.UTC(2025, 8, 1, h, mi + 40));
        return {
          curso,
          paralelo,
          dia,
          hora_inicio: inicio,
          hora_fin: `${pad(fin.getUTCHours(), 2)}:${pad(fin.getUTCMinutes(), 2)}`,
          materia,
          docente_codigo: String(docentes.filter((d) => d.materia_principal === materia)[paralelo === "A" ? 0 : 1]!.codigo),
        };
      }),
    ),
  ),
);

// --- Estudiantes ---
interface Est {
  codigo: string;
  asistenciaBase: number; // probabilidad de asistir
  rendimiento: number; // nota media esperada
  familiaMorosa: boolean;
  beca: number;
}
const estudiantes: Est[] = [];
const filasEst: Fila[] = [];
let n = 0;
for (const curso of CURSOS) {
  for (const paralelo of PARALELOS) {
    for (let k = 0; k < 20; k++) {
      n++;
      const codigo = `EST-${pad(n)}`;
      const asistenciaBase = acotar(normal(0.93, 0.05), 0.65, 1);
      const rendimiento = acotar(normal(7.6, 1.0) + (asistenciaBase - 0.93) * 12, 3.5, 9.9);
      const beca = elegir(BECAS);
      const familiaMorosa = azar() < (beca > 0 ? 0.06 : 0.12);
      estudiantes.push({ codigo, asistenciaBase, rendimiento, familiaMorosa, beca });
      const edad = 12 + CURSOS.indexOf(curso);
      filasEst.push({
        codigo,
        nombre_ficticio: `${elegir(NOMBRES)} ${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`,
        curso,
        paralelo,
        anio_nacimiento: 2025 - edad - (azar() < 0.3 ? 1 : 0),
        genero: elegir(["F", "M", "F", "M", "F", "M", "F", "M", "X"] as const),
        necesidad_educativa: elegir(NEE),
        beca_porcentaje: beca,
        representante_codigo: `REP-${pad(Math.ceil(n * 0.85))}`,
        fecha_ingreso: `${2025 - Math.floor(entre(0, CURSOS.indexOf(curso) + 1))}-09-01`,
      });
    }
  }
}

// --- Asistencia: días lectivos de septiembre a diciembre de 2025 ---
const diasLectivos: string[] = [];
for (let d = new Date(Date.UTC(2025, 8, 1)); d < new Date(Date.UTC(2025, 11, 20)); d.setUTCDate(d.getUTCDate() + 1)) {
  const dow = d.getUTCDay();
  const iso = d.toISOString().slice(0, 10);
  if (dow === 0 || dow === 6 || iso === "2025-10-10" || iso === "2025-11-03" || iso === "2025-11-04") continue; // fines de semana y feriados
  diasLectivos.push(iso);
}
const asistencia: Fila[] = estudiantes.flatMap((e) =>
  diasLectivos.map((fecha) => {
    const estado = azar() < e.asistenciaBase ? (azar() < 0.04 ? "atraso" : "presente") : azar() < 0.45 ? "falta_justificada" : "falta_injustificada";
    return { codigo_estudiante: e.codigo, fecha, estado };
  }),
);

// --- Notas: 2 quimestres × 3 parciales (sistema ecuatoriano, sobre 10) ---
const notas: Fila[] = estudiantes.flatMap((e) =>
  MATERIAS.flatMap((materia) => {
    const sesgo = normal(0, 0.6);
    return [1, 2].flatMap((quimestre) =>
      [1, 2, 3].map((parcial) => ({
        codigo_estudiante: e.codigo,
        anio_lectivo: "2025-2026",
        quimestre,
        parcial,
        materia,
        nota: Number(acotar(normal(e.rendimiento + sesgo - (quimestre === 2 ? 0.15 : 0), 0.7), 0, 10).toFixed(2)),
      })),
    );
  }),
);

// --- Pensiones: septiembre 2025 a junio 2026 ---
const MESES = ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
const CORTE = "2026-01"; // fecha de corte del dataset: lo posterior aún no vence
const pensiones: Fila[] = estudiantes.flatMap((e) =>
  MESES.map((mes) => {
    const valor = Number((PENSION_BASE * (1 - e.beca / 100)).toFixed(2));
    if (mes > CORTE) return { codigo_estudiante: e.codigo, mes, valor, estado: "por_vencer", fecha_pago: null };
    const atrasa = e.familiaMorosa ? azar() < 0.55 : azar() < 0.06;
    if (atrasa && azar() < 0.5) return { codigo_estudiante: e.codigo, mes, valor, estado: "vencido", fecha_pago: null };
    const dia = atrasa ? Math.floor(entre(11, 28)) : Math.floor(entre(1, 10));
    return { codigo_estudiante: e.codigo, mes, valor, estado: "pagado", fecha_pago: `${mes}-${pad(dia, 2)}` };
  }),
);

const README = `# Dataset ficticio de un colegio · Hackathon EduTech 2026

**Todos los datos son sintéticos.** Fueron generados por un programa con una semilla fija: no
corresponden a ninguna persona real, aunque los nombres parezcan comunes. Úsalos libremente
(dominio público, CC0) para construir y demostrar tu proyecto.

Colegio imaginario con ${estudiantes.length} estudiantes de 8vo EGB a 3ro BGU, dos paralelos por curso,
año lectivo 2025-2026 (régimen Sierra). Corte de los datos: enero de 2026.

## Archivos

| Archivo | Filas | Una fila es |
| --- | --- | --- |
| estudiantes.csv | ${filasEst.length} | un estudiante |
| asistencia.csv | ${asistencia.length} | un estudiante en un día lectivo (sep–dic 2025) |
| notas.csv | ${notas.length} | una nota parcial de una materia |
| pensiones.csv | ${pensiones.length} | la pensión de un mes |
| horarios.csv | ${horarios.length} | un bloque de clase de un curso y paralelo |
| docentes.csv | ${docentes.length} | un docente |

## Diccionario de datos

**estudiantes.csv**: \`codigo\` (EST-###, clave), \`nombre_ficticio\`, \`curso\`, \`paralelo\` (A/B),
\`anio_nacimiento\`, \`genero\` (F/M/X), \`necesidad_educativa\` (ninguna, TDAH, dislexia, discalculia,
TEA, discapacidad visual), \`beca_porcentaje\` (0, 10, 25, 50), \`representante_codigo\` (REP-###;
hermanos comparten representante), \`fecha_ingreso\`.

**asistencia.csv**: \`codigo_estudiante\`, \`fecha\` (AAAA-MM-DD), \`estado\` (presente, atraso,
falta_justificada, falta_injustificada).

**notas.csv**: \`codigo_estudiante\`, \`anio_lectivo\`, \`quimestre\` (1–2), \`parcial\` (1–3),
\`materia\`, \`nota\` (0 a 10, dos decimales; 7 es la nota mínima para aprobar).

**pensiones.csv**: \`codigo_estudiante\`, \`mes\` (AAAA-MM), \`valor\` (USD, con la beca aplicada sobre
${PENSION_BASE} USD), \`estado\` (pagado, vencido, por_vencer), \`fecha_pago\` (vacía si no se pagó;
después del día 10 es pago tardío).

**horarios.csv**: \`curso\`, \`paralelo\`, \`dia\`, \`hora_inicio\`, \`hora_fin\`, \`materia\`,
\`docente_codigo\`.

**docentes.csv**: \`codigo\` (DOC-##), \`nombre_ficticio\`, \`materia_principal\`.

## Ideas

- Alerta temprana: estudiantes con asistencia baja y notas en descenso.
- Seguimiento de pensiones vencidas por familia (representante).
- Apoyo a estudiantes con necesidades educativas: cruza notas y asistencia.
- Optimización de horarios o carga docente.

Puedes cargar los CSV en n8n, DuckDB, SQLite, Google Sheets o pandas. Si los modificas, sigue
declarando en \`data/README.md\` que son sintéticos.
`;

const zip = zipSync(
  {
    "dataset-ficticio-colegio/README.md": strToU8(README),
    "dataset-ficticio-colegio/estudiantes.csv": strToU8(csv(filasEst)),
    "dataset-ficticio-colegio/asistencia.csv": strToU8(csv(asistencia)),
    "dataset-ficticio-colegio/notas.csv": strToU8(csv(notas)),
    "dataset-ficticio-colegio/pensiones.csv": strToU8(csv(pensiones)),
    "dataset-ficticio-colegio/horarios.csv": strToU8(csv(horarios)),
    "dataset-ficticio-colegio/docentes.csv": strToU8(csv(docentes)),
  },
  { level: 9, mtime: new Date("2026-10-01T00:00:00Z") },
);
const destino = path.join(process.cwd(), "public", "dataset-ficticio-colegio.zip");
writeFileSync(destino, zip);
console.log(`public/dataset-ficticio-colegio.zip · ${Math.round(zip.length / 1024)} KB · ${estudiantes.length} estudiantes`);
