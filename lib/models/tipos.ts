/**
 * Modelo de datos de Firestore (equivalente a las tablas del prompt §7).
 * Cada interfaz documenta una colección; el id del documento se indica en el comentario.
 * Las fechas son `Timestamp` de Firestore en la base y `Date` en el código del servidor.
 */
import type { MentoriaTema, RolEquipo, TrackCode } from "@/config/event";
import type { StaffRole } from "@/lib/auth/roles";
import type { Categoria } from "@/lib/models/categoria";

type Fecha = Date;

/** events/{eventId} */
export interface EventDoc {
  nombre: string;
  resultadosPublicados: boolean;
  resultadosPublicadosAt: Fecha | null;
}

/** tracks/{T1|T2|T3} */
export interface TrackDoc {
  codigo: TrackCode;
  nombre: string;
  pregunta: string;
}

export type Nivel = "colegio" | "universidad" | "profesional" | "docente";
export type Escala14 = 1 | 2 | 3 | 4;

export interface PerfilTecnico {
  rolPreferido: RolEquipo;
  niveles: { desarrollo: Escala14; n8n: Escala14; ia: Escala14; diseno: Escala14 };
  tecnologias: string[];
  hackathonsPrevios: number;
}

/** participants/{authUid} */
export interface ParticipantDoc {
  nombres: string;
  apellidos: string;
  email: string;
  celular: string;
  fechaNacimiento: string; // YYYY-MM-DD
  ciudad: string;
  institucion: string;
  nivel: Nivel;
  githubUsername: string;
  talla: "XS" | "S" | "M" | "L" | "XL" | "XXL";
  restriccionesAlimentarias: string;
  accesibilidad: string;
  categoria: Categoria;
  perfilTecnico: PerfilTecnico;
  teamId: string | null;
  enListaEspera: boolean;
  createdAt: Fecha;
}

/** guardians/{participantId} · solo admin y comite */
export interface GuardianDoc {
  participantId: string;
  nombre: string;
  documento: string; // cédula: único dato de identidad que se pide (prompt §10)
  contacto: string;
  archivoPath: string | null; // Storage privado
  estado: "pendiente" | "validado" | "rechazado";
  validadoPor: string | null;
}

/** consents/{autoId} */
export interface ConsentDoc {
  participantId: string;
  tipo: "reglas" | "datos_personales" | "uso_imagen" | "autorizacion_menor";
  version: string;
  aceptado: boolean;
  timestamp: Fecha;
  ip: string | null;
}

/** teams/{teamId} */
export interface TeamDoc {
  nombre: string;
  slug: string;
  track: TrackCode;
  categoria: "JUNIOR" | "OPEN" | "MIXTO";
  codigoInvitacion: string;
  estado: "incompleto" | "completo" | "descalificado";
  problemaCandidato: string;
  roomId: string | null; // denormalizado desde presentation_slots para las reglas del jurado
  adultoResponsableId: string | null;
  createdAt: Fecha;
}

/** team_members/{teamId}_{participantId} */
export interface TeamMemberDoc {
  teamId: string;
  participantId: string;
  nombre: string; // nombre visible para el equipo (sin datos de contacto)
  githubUsername: string;
  rol: RolEquipo;
  esCapitan: boolean;
}

/** checkins/{participantId}_{dia} */
export interface CheckinDoc {
  participantId: string;
  teamId: string | null;
  dia: "viernes" | "sabado";
  timestamp: Fecha;
  staffId: string;
}

/** repositories/{teamId} */
export interface RepositoryDoc {
  teamId: string;
  url: string;
  owner: string;
  name: string;
  createdAtGithub: Fecha;
  validado: boolean;
  motivos: string[];
}

/** repo_snapshots/{autoId} */
export interface RepoSnapshotDoc {
  repositoryId: string;
  teamId: string;
  tomadoEn: Fecha;
  commitsEnVentana: number;
  autores: string[];
  ultimoCommitAt: Fecha | null;
  archivosObligatorios: Record<string, boolean>;
  alertas: { tipo: string; detalle: string }[];
  checkpoint1: boolean;
  checkpoint2: boolean;
}

/** submissions/{teamId} */
export interface SubmissionDoc {
  teamId: string;
  demoUrl: string | "ejecucion-local";
  pitchPath: string;
  videoUrl: string | null;
  declaraciones: { datosSinteticos: boolean; priorWork: boolean; aiUsage: boolean };
  tagSha: string;
  tagCommitAt: Fecha;
  enviadoAt: Fecha;
}

/** admissibility/{teamId} */
export interface AdmissibilityDoc {
  teamId: string;
  a1: boolean;
  a2: boolean;
  a3: boolean;
  a4: boolean;
  a5: boolean;
  observaciones: string;
  revisadoPor: string | null;
}

/** mentor_requests/{autoId} */
export interface MentorRequestDoc {
  teamId: string;
  tema: MentoriaTema;
  estado: "abierta" | "atendida" | "cerrada";
  mentorId: string | null;
  abiertaAt: Fecha;
  atendidaAt: Fecha | null;
}

/** judges/{authUid} */
export interface JudgeDoc {
  nombre: string;
  perfil: "tecnico" | "educativo" | "negocio";
  roomId: string | null;
}

/** rooms/{roomId} */
export interface RoomDoc {
  nombre: string;
  tracks: TrackCode[];
  cerrada: boolean; // al cerrar la sala se bloquean los puntajes
}

/** presentation_slots/{roomId}_{orden} */
export interface PresentationSlotDoc {
  roomId: string;
  teamId: string;
  orden: number;
  ronda: "semifinal" | "final";
  horaProgramada: Fecha;
  inicioReal: Fecha | null;
  finReal: Fecha | null;
}

/** conflicts/{judgeId}_{teamId} */
export interface ConflictDoc {
  judgeId: string;
  teamId: string;
  motivo: string;
}

/** rubric_criteria/{C1..C6} */
export interface RubricCriterionDoc {
  codigo: string;
  nombre: string;
  peso: number;
  descriptores: Record<string, string>;
}

/** scores/{ronda}_{judgeId}_{teamId} */
export interface ScoreDoc {
  judgeId: string;
  teamId: string;
  roomId: string;
  ronda: "semifinal" | "final";
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  c6: number;
  tiempoUsadoSeg: number;
  demoEnVivo: boolean;
  fortaleza: string;
  recomendacion: string;
  enviadoAt: Fecha;
  bloqueado: boolean;
}

/** announcements/{autoId} */
export interface AnnouncementDoc {
  alcance: { tipo: "todos" } | { tipo: "track"; track: TrackCode } | { tipo: "equipo"; teamId: string };
  mensaje: string;
  enviadoAt: Fecha;
  autorId: string;
}

/** audit_log/{autoId} · ver lib/audit.ts */
export interface AuditLogDoc {
  actor: string;
  accion: string;
  entidad: string;
  entidadId: string;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  timestamp: Fecha;
}

/** staff/{authUid} */
export interface StaffDoc {
  nombre: string;
  roles: StaffRole[];
}
