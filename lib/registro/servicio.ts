import "server-only";
import { FieldValue, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { EVENT } from "@/config/event";
import { auditarEn } from "@/lib/audit";
import { CONSENTIMIENTOS, VERSION_CONSENTIMIENTOS, type TipoConsentimiento } from "@/lib/content/consentimientos";
import { encolarEn, despachar } from "@/lib/eventos";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { calcularCategoria, categoriaEquipo, type Categoria } from "@/lib/models/categoria";
import type { Evento } from "@/lib/n8n";
import { estadoEquipo, generarCodigo, hayLugar, slugEquipo, vaAListaEspera } from "@/lib/registro/reglas";
import type { Paso1, Paso2, Paso3, Paso4, Representante } from "@/lib/validation/registro";

/** Error de negocio con mensaje para la persona y, si aplica, el campo que lo causó. */
export class ErrorRegistro extends Error {
  constructor(
    message: string,
    readonly campo: string = "_",
  ) {
    super(message);
  }
}

export interface Borrador {
  paso: number;
  modo?: Paso1["modo"];
  codigo?: string;
  equipoUnirse?: { id: string; nombre: string; track: string };
  personales?: Paso2;
  githubVerificado?: "existe" | "sin-verificar";
  perfil?: Paso3;
  equipo?: Paso4;
}

const db = () => adminDb();
const draftRef = (uid: string) => db().doc(`registration_drafts/${uid}`);
const statsRef = () => db().doc("stats/inscripciones");

export async function cargarBorrador(uid: string): Promise<Borrador> {
  const snap = await draftRef(uid).get();
  if (!snap.exists) return { paso: 1 };
  // actualizadoAt es un Timestamp: no se envía al cliente (no es serializable para el componente).
  const datos = { ...(snap.data() as Borrador & { actualizadoAt?: unknown }) };
  delete datos.actualizadoAt;
  return { ...datos, paso: datos.paso ?? 1 };
}

/** Guarda el progreso en el servidor para no perder datos si se cierra la pestaña. */
export async function guardarBorrador(uid: string, borrador: Borrador): Promise<void> {
  await draftRef(uid).set({ ...borrador, actualizadoAt: FieldValue.serverTimestamp() });
}

export interface EquipoResumen {
  id: string;
  nombre: string;
  track: string;
  miembros: number;
}

export async function buscarEquipoPorCodigo(codigo: string): Promise<EquipoResumen | null> {
  const q = await db().collection("teams").where("codigoInvitacion", "==", codigo.toUpperCase()).limit(1).get();
  const d = q.docs[0];
  if (!d) return null;
  return { id: d.id, nombre: d.get("nombre"), track: d.get("track"), miembros: d.get("miembros") ?? 0 };
}

export async function nombreEquipoDisponible(nombre: string): Promise<boolean> {
  const slug = slugEquipo(nombre);
  return slug.length >= 3 && !(await db().doc(`teams/${slug}`).get()).exists;
}

/** Invitación pendiente a nombre de este correo (para precargar el código en el paso 1). */
export async function invitacionPendiente(email: string): Promise<{ codigo: string; equipo: string } | null> {
  const q = await db()
    .collection("invitations")
    .where("email", "==", email.toLowerCase())
    .where("estado", "==", "pendiente")
    .limit(1)
    .get();
  const inv = q.docs[0];
  if (!inv) return null;
  const team = await db().doc(`teams/${inv.get("teamId")}`).get();
  return team.exists ? { codigo: team.get("codigoInvitacion"), equipo: team.get("nombre") } : null;
}

async function codigoUnico(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const codigo = generarCodigo();
    const q = await db().collection("teams").where("codigoInvitacion", "==", codigo).limit(1).get();
    if (q.empty) return codigo;
  }
  throw new Error("No se pudo generar un código de invitación único");
}

export const invitacionId = (teamId: string, email: string) => `${teamId}_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

function sumarCategoria(conteo: Partial<Record<Categoria, number>> | undefined, cat: Categoria): Record<Categoria, number> {
  const c = { JUNIOR: conteo?.JUNIOR ?? 0, OPEN: conteo?.OPEN ?? 0 };
  c[cat] += 1;
  return c;
}

function categoriaDesdeConteo(c: Record<Categoria, number>) {
  return categoriaEquipo([...Array<Categoria>(c.JUNIOR).fill("JUNIOR"), ...Array<Categoria>(c.OPEN).fill("OPEN")]);
}

/** Lecturas para sumar una persona a un equipo existente (Firestore exige leer todo antes de escribir). */
async function leerUnion(tx: Transaction, teamRef: DocumentReference, email: string) {
  const team = await tx.get(teamRef);
  if (!team.exists) throw new ErrorRegistro("Ese equipo ya no existe. Pide un código nuevo a tu capitán.", "codigo");
  const miembros: number = team.get("miembros") ?? 0;
  if (!hayLugar(miembros)) throw new ErrorRegistro("Ese equipo ya tiene 5 integrantes.", "codigo");
  const invRef = db().doc(`invitations/${invitacionId(team.id, email)}`);
  const inv = await tx.get(invRef);
  return { team, miembros, invRef, inv };
}

/** Escrituras de la unión: suma integrante, recalcula estado y categoría, acepta la invitación. */
function aplicarUnion(tx: Transaction, u: Awaited<ReturnType<typeof leerUnion>>, uid: string, categoria: Categoria, eventos: Evento[]) {
  const conteo = sumarCategoria(u.team.get("conteoCategorias"), categoria);
  const nuevos = u.miembros + 1;
  tx.update(u.team.ref, {
    miembros: nuevos,
    estado: estadoEquipo(nuevos),
    conteoCategorias: conteo,
    categoria: categoriaDesdeConteo(conteo),
    requiereAdulto: conteo.JUNIOR > 0,
  });
  if (u.inv.exists) tx.update(u.invRef, { estado: "aceptada", aceptadaAt: FieldValue.serverTimestamp(), participantId: uid });
  if (u.miembros < EVENT.equipo.min && nuevos >= EVENT.equipo.min) {
    eventos.push(encolarEn(tx, "team.completed", { teamId: u.team.id, teamNombre: u.team.get("nombre"), miembros: nuevos }));
  }
  return nuevos;
}

export interface DatosConfirmacion {
  uid: string;
  email: string;
  ip: string | null;
  borrador: Borrador & Required<Pick<Borrador, "modo" | "personales" | "perfil">>;
  aceptaImagen: boolean;
  representante: Representante | null;
  archivo: Uint8Array | null;
}

export interface ResultadoConfirmacion {
  teamId: string | null;
  teamNombre: string | null;
  listaEspera: boolean;
  categoria: Categoria;
}

export async function confirmarRegistro(d: DatosConfirmacion): Promise<ResultadoConfirmacion> {
  const { uid, borrador } = d;
  const email = d.email.toLowerCase();
  const cat = calcularCategoria(borrador.personales.fechaNacimiento);
  if (!cat.ok) throw new ErrorRegistro(cat.motivo, "fechaNacimiento");
  const categoria = cat.categoria;
  if (categoria === "JUNIOR" && (!d.representante || !d.archivo)) {
    throw new ErrorRegistro("Para la categoría Junior se necesitan los datos del representante y la autorización firmada.", "archivo");
  }

  const codigoNuevo = borrador.modo === "equipo" ? await codigoUnico() : null;
  const archivoPath = categoria === "JUNIOR" ? `autorizaciones/${uid}.pdf` : null;
  if (archivoPath && d.archivo) {
    // Bucket privado: storage.rules niega todo acceso del cliente; se lee con URLs firmadas (D-10).
    await adminStorage().bucket().file(archivoPath).save(Buffer.from(d.archivo), { contentType: "application/pdf", resumable: false });
  }

  const eventos: Evento[] = [];
  let resultado: ResultadoConfirmacion;
  try {
    resultado = await db().runTransaction(async (tx) => {
      eventos.length = 0; // la transacción puede reintentarse
      const pRef = db().doc(`participants/${uid}`);

      // --- Lecturas ---
      const [pSnap, stats] = await Promise.all([tx.get(pRef), tx.get(statsRef())]);
      if (pSnap.exists) throw new ErrorRegistro("Ya estás inscrito. Revisa tu equipo en Mi equipo.");
      const conteos = { personas: stats.get("personas") ?? 0, equipos: stats.get("equipos") ?? 0 };
      const listaEspera = vaAListaEspera(conteos, borrador.modo === "equipo");

      let union: Awaited<ReturnType<typeof leerUnion>> | null = null;
      let slug: string | null = null;
      if (!listaEspera && borrador.modo === "unirse") {
        if (!borrador.equipoUnirse) throw new ErrorRegistro("Vuelve al paso 1 e ingresa el código de tu equipo.", "codigo");
        union = await leerUnion(tx, db().doc(`teams/${borrador.equipoUnirse.id}`), email);
      }
      if (!listaEspera && borrador.modo === "equipo") {
        if (!borrador.equipo) throw new ErrorRegistro("Vuelve al paso 4 y completa los datos del equipo.", "nombreEquipo");
        slug = slugEquipo(borrador.equipo.nombreEquipo);
        if ((await tx.get(db().doc(`teams/${slug}`))).exists) {
          throw new ErrorRegistro("Ya existe un equipo con ese nombre. Elige otro en el paso 4.", "nombreEquipo");
        }
      }

      // --- Escrituras ---
      const p = borrador.personales;
      const nombreCompleto = `${p.nombres} ${p.apellidos}`;
      let teamId: string | null = null;
      let teamNombre: string | null = null;

      if (slug && borrador.equipo && codigoNuevo) {
        const eq = borrador.equipo;
        teamId = slug;
        teamNombre = eq.nombreEquipo;
        const conteo = sumarCategoria(undefined, categoria);
        tx.set(db().doc(`teams/${slug}`), {
          nombre: eq.nombreEquipo,
          slug,
          track: eq.track,
          categoria: categoriaDesdeConteo(conteo),
          conteoCategorias: conteo,
          codigoInvitacion: codigoNuevo,
          estado: estadoEquipo(1),
          miembros: 1,
          problemaCandidato: eq.problemaCandidato,
          roomId: null,
          capitanId: uid,
          requiereAdulto: conteo.JUNIOR > 0,
          adultoResponsableId: null,
          createdAt: FieldValue.serverTimestamp(),
        });
        for (const correo of eq.correosIntegrantes) {
          const c = correo.toLowerCase();
          tx.set(db().doc(`invitations/${invitacionId(slug, c)}`), {
            teamId: slug,
            email: c,
            estado: "pendiente",
            invitadoPor: uid,
            creadaAt: FieldValue.serverTimestamp(),
          });
          eventos.push(
            encolarEn(tx, "team.invitation", {
              teamId: slug,
              teamNombre: eq.nombreEquipo,
              track: eq.track,
              correo: c,
              codigo: codigoNuevo,
              enlace: `${process.env.APP_BASE_URL ?? ""}/registro?codigo=${codigoNuevo}`,
              invitadoPor: nombreCompleto,
            }),
          );
        }
        tx.set(statsRef(), { equipos: FieldValue.increment(1) }, { merge: true });
      }

      if (union) {
        teamId = union.team.id;
        teamNombre = union.team.get("nombre");
        aplicarUnion(tx, union, uid, categoria, eventos);
      }

      if (teamId) {
        tx.set(db().doc(`team_members/${teamId}_${uid}`), {
          teamId,
          participantId: uid,
          nombre: nombreCompleto,
          githubUsername: p.githubUsername,
          rol: borrador.perfil.rolPreferido,
          esCapitan: borrador.modo === "equipo",
        });
      }

      const perfil = borrador.perfil;
      const tecnologias = [...perfil.tecnologias, ...(perfil.otraTecnologia ? [perfil.otraTecnologia] : [])];
      tx.set(pRef, {
        nombres: p.nombres,
        apellidos: p.apellidos,
        email,
        celular: p.celular,
        fechaNacimiento: p.fechaNacimiento,
        ciudad: p.ciudad,
        institucion: p.institucion,
        nivel: p.nivel,
        githubUsername: p.githubUsername,
        githubVerificado: borrador.githubVerificado ?? "sin-verificar",
        talla: p.talla,
        restriccionesAlimentarias: p.restriccionesAlimentarias,
        accesibilidad: p.accesibilidad,
        categoria,
        perfilTecnico: { rolPreferido: perfil.rolPreferido, niveles: perfil.niveles, tecnologias, hackathonsPrevios: perfil.hackathonsPrevios },
        modoInscripcion: borrador.modo,
        teamId,
        enListaEspera: listaEspera,
        // Si quedó en lista de espera, se guarda lo que pidió para que la organización lo atienda.
        solicitudEquipo: listaEspera ? { modo: borrador.modo, equipo: borrador.equipo ?? null, codigo: borrador.codigo ?? null } : null,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(statsRef(), listaEspera ? { listaEspera: FieldValue.increment(1) } : { personas: FieldValue.increment(1) }, { merge: true });

      const aceptados: [TipoConsentimiento, boolean][] = [
        ["reglas", true],
        ["datos_personales", true],
        ["uso_imagen", d.aceptaImagen],
      ];
      if (categoria === "JUNIOR") aceptados.push(["autorizacion_menor", true]);
      for (const [tipo, aceptado] of aceptados) {
        tx.set(db().doc(`consents/${uid}_${tipo}`), {
          participantId: uid,
          tipo,
          version: VERSION_CONSENTIMIENTOS,
          texto: CONSENTIMIENTOS[tipo].texto,
          aceptado,
          timestamp: FieldValue.serverTimestamp(),
          ip: d.ip,
        });
      }

      if (categoria === "JUNIOR" && d.representante) {
        tx.set(db().doc(`guardians/${uid}`), {
          participantId: uid,
          nombre: d.representante.nombres,
          documento: d.representante.cedula,
          contacto: { correo: d.representante.correo, celular: d.representante.celular },
          parentesco: d.representante.parentesco,
          archivoPath,
          estado: "pendiente",
          validadoPor: null,
          creadoAt: FieldValue.serverTimestamp(),
        });
      }

      tx.delete(draftRef(uid));
      auditarEn(tx, {
        actor: uid,
        accion: "registration.create",
        entidad: "participants",
        entidadId: uid,
        // Sin datos de contacto en la auditoría: solo lo necesario para reconstruir la decisión.
        despues: { categoria, modo: borrador.modo, teamId, listaEspera },
      });
      eventos.push(
        encolarEn(tx, "registration.created", {
          participantId: uid,
          nombres: p.nombres,
          email,
          categoria,
          modo: borrador.modo,
          teamId,
          teamNombre,
          codigoInvitacion: slug ? codigoNuevo : null,
          listaEspera,
          requiereAutorizacion: categoria === "JUNIOR",
        }),
      );

      return { teamId, teamNombre, listaEspera, categoria };
    });
  } catch (err) {
    if (archivoPath) await adminStorage().bucket().file(archivoPath).delete({ ignoreNotFound: true }).catch(() => undefined);
    throw err;
  }

  await despachar(eventos);
  return resultado;
}

/** Une a una persona ya inscrita (sin equipo, p. ej. en matchmaking) a un equipo con su código. */
export async function unirseConCodigo(uid: string, codigo: string): Promise<{ teamId: string; teamNombre: string }> {
  const equipo = await buscarEquipoPorCodigo(codigo);
  if (!equipo) throw new ErrorRegistro("No encontramos un equipo con ese código. Revisa las letras o pídelo a tu capitán.", "codigo");
  const eventos: Evento[] = [];
  const r = await db().runTransaction(async (tx) => {
    eventos.length = 0;
    const pRef = db().doc(`participants/${uid}`);
    const p = await tx.get(pRef);
    if (!p.exists) throw new ErrorRegistro("Primero completa tu inscripción.");
    if (p.get("teamId")) throw new ErrorRegistro("Ya perteneces a un equipo: una persona solo puede estar en un equipo.", "codigo");
    if (p.get("enListaEspera")) throw new ErrorRegistro("Estás en lista de espera: la organización te avisará cuando haya cupo.", "codigo");
    const union = await leerUnion(tx, db().doc(`teams/${equipo.id}`), p.get("email"));
    const nuevos = aplicarUnion(tx, union, uid, p.get("categoria") as Categoria, eventos);
    tx.update(pRef, { teamId: union.team.id });
    tx.set(db().doc(`team_members/${union.team.id}_${uid}`), {
      teamId: union.team.id,
      participantId: uid,
      nombre: `${p.get("nombres")} ${p.get("apellidos")}`,
      githubUsername: p.get("githubUsername"),
      rol: p.get("perfilTecnico.rolPreferido"),
      esCapitan: false,
    });
    auditarEn(tx, { actor: uid, accion: "team.join", entidad: "teams", entidadId: union.team.id, antes: { miembros: union.miembros }, despues: { miembros: nuevos } });
    return { teamId: union.team.id, teamNombre: union.team.get("nombre") as string };
  });
  await despachar(eventos);
  return r;
}
