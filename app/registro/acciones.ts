"use server";

import { headers } from "next/headers";
import { getIdentidad } from "@/lib/auth/session";
import { adminAuth } from "@/lib/firebase/admin";
import { inscripcionesAbiertas } from "@/lib/event/phase";
import { ahora } from "@/lib/event/reloj";
import { verificarUsuarioGithub } from "@/lib/github-usuarios";
import { log } from "@/lib/log";
import { calcularCategoria } from "@/lib/models/categoria";
import {
  buscarEquipoPorCodigo,
  cargarBorrador,
  confirmarRegistro,
  ErrorRegistro,
  guardarBorrador,
  nombreEquipoDisponible,
  type Borrador,
} from "@/lib/registro/servicio";
import {
  erroresPorCampo,
  paso1Schema,
  paso2Schema,
  paso3Schema,
  paso4Schema,
  paso5Schema,
  representanteSchema,
  validarPdf,
} from "@/lib/validation/registro";

export type RespuestaPaso = { ok: true; borrador: Borrador } | { ok: false; errores: Record<string, string> };
export type RespuestaConfirmar = { ok: true } | { ok: false; errores: Record<string, string> };

const fallo = (mensaje: string, campo = "_") => ({ ok: false as const, errores: { [campo]: mensaje } });

/** Comprobaciones comunes: sesión, ventana de inscripción y que no esté ya inscrito. */
async function contexto(): Promise<{ uid: string } | { error: { ok: false; errores: Record<string, string> } }> {
  const id = await getIdentidad();
  if (!id) return { error: fallo("Tu sesión expiró. Vuelve a ingresar con tu correo.") };
  if (id.esParticipante) return { error: fallo("Ya estás inscrito. Revisa tu equipo en Mi equipo.") };
  if (!inscripcionesAbiertas(ahora())) return { error: fallo("Las inscripciones no están abiertas en este momento.") };
  return { uid: id.uid };
}

/** Valida y guarda un paso (1 a 4). El progreso queda en el servidor. */
export async function guardarPaso(paso: 1 | 2 | 3 | 4, datos: unknown): Promise<RespuestaPaso> {
  const ctx = await contexto();
  if ("error" in ctx) return ctx.error;
  const borrador = await cargarBorrador(ctx.uid);

  if (paso === 1) {
    const r = paso1Schema.safeParse(datos);
    if (!r.success) return { ok: false, errores: erroresPorCampo(r.error) };
    let equipoUnirse: Borrador["equipoUnirse"];
    if (r.data.modo === "unirse") {
      const eq = await buscarEquipoPorCodigo(r.data.codigo!);
      if (!eq) return fallo("No encontramos un equipo con ese código. Revisa las letras o pídelo a tu capitán.", "codigo");
      if (eq.miembros >= 5) return fallo("Ese equipo ya tiene 5 integrantes.", "codigo");
      equipoUnirse = { id: eq.id, nombre: eq.nombre, track: eq.track };
    }
    const nuevo: Borrador = { ...borrador, modo: r.data.modo, paso: 2 };
    if (r.data.modo === "unirse") Object.assign(nuevo, { codigo: r.data.codigo, equipoUnirse });
    else {
      delete nuevo.codigo;
      delete nuevo.equipoUnirse;
    }
    if (r.data.modo !== "equipo") delete nuevo.equipo;
    await guardarBorrador(ctx.uid, nuevo);
    return { ok: true, borrador: nuevo };
  }

  if (!borrador.modo) return fallo("Empieza por el paso 1: elige cómo quieres inscribirte.");

  if (paso === 2) {
    const r = paso2Schema.safeParse(datos);
    if (!r.success) return { ok: false, errores: erroresPorCampo(r.error) };
    const gh = await verificarUsuarioGithub(r.data.githubUsername);
    if (gh === "no-existe") {
      return fallo(`No encontramos el usuario ${r.data.githubUsername} en GitHub. Revisa que esté bien escrito.`, "githubUsername");
    }
    const nuevo: Borrador = { ...borrador, personales: r.data, githubVerificado: gh, paso: 3 };
    await guardarBorrador(ctx.uid, nuevo);
    return { ok: true, borrador: nuevo };
  }

  if (paso === 3) {
    const r = paso3Schema.safeParse(datos);
    if (!r.success) return { ok: false, errores: erroresPorCampo(r.error) };
    const nuevo: Borrador = { ...borrador, perfil: r.data, paso: borrador.modo === "equipo" ? 4 : 5 };
    await guardarBorrador(ctx.uid, nuevo);
    return { ok: true, borrador: nuevo };
  }

  // Paso 4: solo para quien inscribe un equipo.
  if (borrador.modo !== "equipo") return fallo("Este paso es solo para inscribir un equipo.");
  const r = paso4Schema.safeParse(datos);
  if (!r.success) return { ok: false, errores: erroresPorCampo(r.error) };
  if (!(await nombreEquipoDisponible(r.data.nombreEquipo))) {
    return fallo("Ya existe un equipo con ese nombre (o uno muy parecido). Elige otro.", "nombreEquipo");
  }
  const user = await adminAuth().getUser(ctx.uid);
  if (r.data.correosIntegrantes.some((c) => c.toLowerCase() === user.email?.toLowerCase())) {
    return fallo("No incluyas tu propio correo: ya formas parte del equipo.", "correosIntegrantes");
  }
  const nuevo: Borrador = { ...borrador, equipo: r.data, paso: 5 };
  await guardarBorrador(ctx.uid, nuevo);
  return { ok: true, borrador: nuevo };
}

/** Vuelve a un paso anterior sin perder lo guardado. */
export async function irAPaso(paso: number): Promise<void> {
  const id = await getIdentidad();
  if (!id || id.esParticipante) return;
  const borrador = await cargarBorrador(id.uid);
  if (paso >= 1 && paso < borrador.paso) await guardarBorrador(id.uid, { ...borrador, paso });
}

async function ipCliente(): Promise<string | null> {
  const h = await headers();
  return h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** Paso 5: consentimientos (+ representante y PDF si es Junior) y confirmación final. */
export async function confirmar(formData: FormData): Promise<RespuestaConfirmar> {
  const ctx = await contexto();
  if ("error" in ctx) return ctx.error;
  const borrador = await cargarBorrador(ctx.uid);

  // Revalida todo lo guardado: el servidor no confía en el orden en que llegó el cliente.
  const p1 = paso1Schema.safeParse({ modo: borrador.modo, codigo: borrador.codigo });
  const p2 = paso2Schema.safeParse(borrador.personales);
  const p3 = paso3Schema.safeParse(borrador.perfil);
  if (!p1.success) return fallo("Vuelve al paso 1 y elige cómo inscribirte.");
  if (!p2.success) return fallo("Vuelve al paso 2: faltan datos personales.");
  if (!p3.success) return fallo("Vuelve al paso 3: falta tu perfil técnico.");
  if (borrador.modo === "equipo" && !paso4Schema.safeParse(borrador.equipo).success) {
    return fallo("Vuelve al paso 4: faltan los datos del equipo.");
  }

  const r5 = paso5Schema.safeParse({
    aceptaReglas: formData.get("aceptaReglas") === "on",
    aceptaDatos: formData.get("aceptaDatos") === "on",
    aceptaImagen: formData.get("aceptaImagen") === "on",
  });
  if (!r5.success) return { ok: false, errores: erroresPorCampo(r5.error) };

  const cat = calcularCategoria(p2.data.fechaNacimiento);
  let representante = null;
  let archivo: Uint8Array | null = null;
  if (cat.ok && cat.categoria === "JUNIOR") {
    const rr = representanteSchema.safeParse({
      nombres: formData.get("rep_nombres"),
      cedula: formData.get("rep_cedula"),
      correo: formData.get("rep_correo"),
      celular: formData.get("rep_celular"),
      parentesco: formData.get("rep_parentesco"),
    });
    const errores: Record<string, string> = rr.success
      ? {}
      : Object.fromEntries(Object.entries(erroresPorCampo(rr.error)).map(([k, v]) => [`rep_${k}`, v]));
    const f = formData.get("archivo");
    if (!(f instanceof File) || f.size === 0) errores.archivo = "Adjunta la autorización firmada en PDF.";
    else {
      archivo = new Uint8Array(await f.arrayBuffer());
      const e = validarPdf(f.name, f.type, archivo);
      if (e) errores.archivo = e;
    }
    if (Object.keys(errores).length) return { ok: false, errores };
    representante = rr.success ? rr.data : null;
  }

  const user = await adminAuth().getUser(ctx.uid);
  if (!user.email) return fallo("Tu cuenta no tiene un correo verificado. Vuelve a ingresar.");

  try {
    await confirmarRegistro({
      uid: ctx.uid,
      email: user.email,
      ip: await ipCliente(),
      borrador: { ...borrador, modo: p1.data.modo, personales: p2.data, perfil: p3.data },
      aceptaImagen: r5.data.aceptaImagen,
      representante,
      archivo,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof ErrorRegistro) return fallo(err.message, err.campo);
    log.error("Error al confirmar la inscripción", { uid: ctx.uid, error: err instanceof Error ? err.message : "desconocido" });
    return fallo("No pudimos guardar tu inscripción por un error nuestro. Tus datos siguen guardados: inténtalo de nuevo en un minuto.");
  }
}
