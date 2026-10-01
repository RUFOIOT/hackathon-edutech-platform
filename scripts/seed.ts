/**
 * Seed de desarrollo para los emuladores de Firebase (reemplaza a supabase/seed.sql, ver D-01).
 * 40 participantes ficticios, 10 equipos, 3 salas, 4 jueces y cuentas de staff.
 *
 * Uso: con los emuladores corriendo (`npm run emulators`), en otra terminal: `npm run seed`.
 * Se niega a correr si no apunta a emuladores, para no tocar nunca un proyecto real.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { EVENT, ROLES_EQUIPO, TRACKS, TRACK_CODES, type TrackCode } from "../config/event";
import { calcularCategoria, categoriaEquipo, type Categoria } from "../lib/models/categoria";
import { RUBRICA } from "../lib/models/rubrica";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
const esLocal = (h: string) => h.startsWith("127.0.0.1") || h.startsWith("localhost");
if (!esLocal(process.env.FIRESTORE_EMULATOR_HOST) || !esLocal(process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
  throw new Error("El seed solo corre contra emuladores locales.");
}

const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-edutech" });
const db = getFirestore(app);
const auth = getAuth(app);

// PRNG determinista: el mismo seed produce los mismos datos (KPIs verificables en la Fase 6).
let semilla = 20261106;
const rnd = () => (semilla = (semilla * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const dd = (n: number) => String(n).padStart(2, "0");

const NOMBRES = ["Ana", "Luis", "Sofía", "Mateo", "Valeria", "Diego", "Camila", "Andrés", "Isabela", "Joaquín", "Martina", "Tomás", "Emilia", "Sebastián", "Paula", "Nicolás", "Renata", "Gabriel", "Daniela", "Samuel"];
const APELLIDOS = ["Andrade", "Benítez", "Cevallos", "Duque", "Espinosa", "Flores", "Guerrero", "Herrera", "Iturralde", "Jaramillo", "León", "Mora", "Naranjo", "Ortiz", "Paredes", "Quintero", "Ruiz", "Salazar", "Torres", "Vela"];
const CIUDADES = ["Quito", "Quito", "Quito", "Sangolquí", "Cumbayá", "Guayaquil", "Cuenca"];
const TECNOLOGIAS = ["JavaScript", "TypeScript", "Python", "React", "Next.js", "Flutter", "SQL", "Firebase", "Supabase", "n8n", "Figma", "Docker"];
const NOMBRES_EQUIPO = ["Matrícula Express", "Alerta Temprana", "Aula Abierta", "Pensión Clara", "Horario Vivo", "Portafolio Ocho", "Tutor Andino", "Familia Conectada", "Notas al Día", "Ruta NEE"];

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));
const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function crearUsuario(uid: string, email: string, displayName: string) {
  try {
    await auth.createUser({ uid, email, displayName, emailVerified: true });
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/uid-already-exists") throw e;
  }
}

function perfil(desarrolloFijo?: 1) {
  return {
    rolPreferido: pick(ROLES_EQUIPO),
    niveles: { desarrollo: desarrolloFijo ?? int(1, 4), n8n: int(1, 4), ia: int(1, 4), diseno: int(1, 4) },
    tecnologias: Array.from(new Set([pick(TECNOLOGIAS), pick(TECNOLOGIAS), pick(TECNOLOGIAS)])),
    hackathonsPrevios: int(0, 3),
  };
}

async function main() {
  const batch = db.batch();
  const set = (path: string, data: Record<string, unknown>) => batch.set(db.doc(path), data);

  set(`events/${EVENT.id}`, { nombre: EVENT.nombre, resultadosPublicados: false, resultadosPublicadosAt: null });
  for (const code of TRACK_CODES) set(`tracks/${code}`, { codigo: code, nombre: TRACKS[code].nombre, pregunta: TRACKS[code].pregunta });
  for (const c of RUBRICA) set(`rubric_criteria/${c.codigo}`, { ...c });
  set("public_state/pantalla", { aviso: null, cronometro: null });

  // Salas: una por track (escenario de la guía §5 con 25–30 equipos).
  const salas: { id: string; track: TrackCode }[] = TRACK_CODES.map((t, i) => ({ id: `sala-${i + 1}`, track: t }));
  for (const s of salas) set(`rooms/${s.id}`, { nombre: `Sala ${s.track}`, tracks: [s.track], cerrada: false });

  // Equipos: tamaños 5,4,4,4,4,3,3,3,2,2 = 34 personas + 6 individuales sin equipo = 40.
  const tamanos = [5, 4, 4, 4, 4, 3, 3, 3, 2, 2];
  let n = 0;
  for (const [e, tam] of tamanos.entries()) {
    const nombreEquipo = NOMBRES_EQUIPO[e] as string;
    const teamId = `equipo-${dd(e + 1)}`;
    const track = TRACK_CODES[e % 3] as TrackCode;
    const esJunior = e === 8; // un equipo 100 % Junior (premio de categoría)
    const categorias: Categoria[] = [];

    for (let m = 0; m < tam; m++) {
      n++;
      const pid = `p-${String(n).padStart(3, "0")}`;
      const junior = esJunior || (e === 7 && m === tam - 1); // equipo 08 queda MIXTO
      const nacimiento = junior ? `20${dd(int(9, 11))}-${dd(int(1, 9))}-${dd(int(10, 28))}` : `19${int(85, 99)}-${dd(int(1, 12))}-${dd(int(10, 28))}`;
      const cat = calcularCategoria(nacimiento);
      if (!cat.ok) throw new Error(`Seed inválido: ${pid} ${nacimiento}`);
      categorias.push(cat.categoria);
      const nombres = pick(NOMBRES);
      const apellidos = `${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
      const email = `${pid}@edutech.test`;
      await crearUsuario(pid, email, `${nombres} ${apellidos}`);
      const rol = ROLES_EQUIPO[m % ROLES_EQUIPO.length]!;
      set(`participants/${pid}`, {
        nombres,
        apellidos,
        email,
        celular: `09${int(10000000, 99999999)}`,
        fechaNacimiento: nacimiento,
        ciudad: pick(CIUDADES),
        institucion: junior ? "Colegio Ficticio Andino" : pick(["Universidad Ficticia del Valle", "Empresa Demo S.A.", "Instituto Demo"]),
        nivel: junior ? "colegio" : pick(["universidad", "profesional", "docente"]),
        githubUsername: `demo-${pid}`,
        talla: pick(["S", "M", "L", "XL"]),
        restriccionesAlimentarias: rnd() < 0.15 ? "Vegetariana" : "",
        accesibilidad: "",
        categoria: cat.categoria,
        // El equipo 06 queda sin perfil de construcción (alerta del mapa de calor, Fase 6).
        perfilTecnico: { ...perfil(e === 5 ? 1 : undefined), rolPreferido: rol },
        teamId,
        enListaEspera: false,
        createdAt: ts(`2026-10-${dd(int(5, 28))}T${dd(int(8, 22))}:00:00-05:00`),
      });
      set(`team_members/${teamId}_${pid}`, {
        teamId,
        participantId: pid,
        nombre: `${nombres} ${apellidos}`,
        githubUsername: `demo-${pid}`,
        rol,
        esCapitan: m === 0,
      });
      for (const tipo of ["reglas", "datos_personales"] as const) {
        set(`consents/${pid}_${tipo}`, { participantId: pid, tipo, version: "v1-borrador", aceptado: true, timestamp: ts("2026-10-10T10:00:00-05:00"), ip: null });
      }
      if (cat.categoria === "JUNIOR") {
        const validado = n % 2 === 0;
        set(`guardians/${pid}`, {
          participantId: pid,
          nombre: `Representante de ${nombres}`,
          documento: `SINTETICO-${n}`,
          contacto: `rep-${pid}@edutech.test`,
          archivoPath: validado ? `autorizaciones/${pid}.pdf` : null,
          estado: validado ? "validado" : "pendiente",
          validadoPor: validado ? "staff-admin" : null,
        });
      }
    }

    const sala = salas.find((s) => s.track === track)!;
    set(`teams/${teamId}`, {
      nombre: nombreEquipo,
      slug: slug(nombreEquipo),
      track,
      categoria: categoriaEquipo(categorias),
      codigoInvitacion: `INV-${dd(e + 1)}${int(1000, 9999)}`,
      estado: tam >= EVENT.equipo.min ? "completo" : "incompleto",
      problemaCandidato: `Problema candidato ficticio del equipo ${nombreEquipo}.`,
      roomId: sala.id,
      adultoResponsableId: categorias.includes("JUNIOR") ? "staff-mentor" : null,
      createdAt: ts("2026-10-12T12:00:00-05:00"),
    });
  }

  // 6 inscripciones individuales sin equipo (matchmaking).
  for (let i = 0; i < 6; i++) {
    n++;
    const pid = `p-${String(n).padStart(3, "0")}`;
    const nombres = pick(NOMBRES);
    const apellidos = `${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
    await crearUsuario(pid, `${pid}@edutech.test`, `${nombres} ${apellidos}`);
    set(`participants/${pid}`, {
      nombres,
      apellidos,
      email: `${pid}@edutech.test`,
      celular: `09${int(10000000, 99999999)}`,
      fechaNacimiento: `19${int(90, 99)}-05-${dd(int(10, 28))}`,
      ciudad: "Quito",
      institucion: "Universidad Ficticia del Valle",
      nivel: "universidad",
      githubUsername: `demo-${pid}`,
      talla: "M",
      restriccionesAlimentarias: "",
      accesibilidad: "",
      categoria: "OPEN",
      perfilTecnico: perfil(),
      teamId: null,
      enListaEspera: false,
      createdAt: ts(`2026-10-${dd(int(5, 28))}T12:00:00-05:00`),
    });
  }

  // 4 jueces ficticios: 2 en sala-1, 1 en sala-2, 1 en sala-3.
  const jueces = [
    { uid: "juez-1", roomId: "sala-1", perfil: "tecnico" },
    { uid: "juez-2", roomId: "sala-1", perfil: "educativo" },
    { uid: "juez-3", roomId: "sala-2", perfil: "tecnico" },
    { uid: "juez-4", roomId: "sala-3", perfil: "negocio" },
  ];
  for (const [i, j] of jueces.entries()) {
    await crearUsuario(j.uid, `${j.uid}@edutech.test`, `Juez Ficticio ${i + 1}`);
    set(`judges/${j.uid}`, { nombre: `Juez Ficticio ${i + 1}`, perfil: j.perfil, roomId: j.roomId });
  }

  // Staff de desarrollo, uno por rol.
  const staff = [
    { uid: "staff-admin", roles: ["admin"] },
    { uid: "staff-comite", roles: ["comite"] },
    { uid: "staff-tecnica", roles: ["mesa_tecnica"] },
    { uid: "staff-checkin", roles: ["checkin"] },
    { uid: "staff-mentor", roles: ["mentor"] },
  ];
  for (const s of staff) {
    await crearUsuario(s.uid, `${s.uid}@edutech.test`, s.uid);
    set(`staff/${s.uid}`, { nombre: s.uid, roles: s.roles });
  }

  await batch.commit();
  console.log(`Seed listo: ${n} participantes, ${tamanos.length} equipos, ${salas.length} salas, ${jueces.length} jueces, ${staff.length} staff.`);
  console.log("Ingresa con cualquier correo *@edutech.test; el enlace mágico se imprime en la terminal de los emuladores.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
