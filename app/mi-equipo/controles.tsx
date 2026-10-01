"use client";

import { useState, useTransition } from "react";
import { ROLES_EQUIPO, TRACKS, TRACK_CODES } from "@/config/event";
import { NOMBRE_ROL } from "@/lib/content/perfil";
import { claseInput } from "@/components/formulario";
import { cambiarMiRol, cambiarTrack, invitar, solicitarEliminacion, unirme, type Respuesta } from "./acciones";

function useAccion() {
  const [estado, setEstado] = useState<Respuesta | null>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (fn: () => Promise<Respuesta>) => iniciar(async () => setEstado(await fn()));
  const aviso = estado && (
    <p role={estado.ok ? "status" : "alert"} className={`text-sm ${estado.ok ? "text-positive-text" : "font-medium text-danger"}`}>
      {estado.ok ? estado.mensaje : estado.error}
    </p>
  );
  return { pendiente, correr, aviso };
}

const botonPequeno = "rounded border border-border bg-surface px-3 py-2 text-sm font-medium disabled:opacity-60";

export function SelectorRol({ actual }: { actual: string }) {
  const { pendiente, correr, aviso } = useAccion();
  return (
    <div className="grid gap-1">
      <label htmlFor="mi-rol" className="sr-only">
        Mi rol
      </label>
      <select
        id="mi-rol"
        defaultValue={actual}
        disabled={pendiente}
        onChange={(e) => {
          const rol = e.target.value;
          correr(() => cambiarMiRol(rol));
        }}
        className={`${claseInput} py-1 text-sm`}
      >
        {ROLES_EQUIPO.map((r) => (
          <option key={r} value={r}>
            {NOMBRE_ROL[r]}
          </option>
        ))}
      </select>
      {aviso}
    </div>
  );
}

export function CambioTrack({ actual }: { actual: string }) {
  const { pendiente, correr, aviso } = useAccion();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const track = String(new FormData(e.currentTarget).get("track"));
        correr(() => cambiarTrack(track));
      }}
    >
      <div className="grid gap-1">
        <label htmlFor="track" className="text-sm font-medium">
          Track del equipo
        </label>
        <select id="track" name="track" defaultValue={actual} className={`${claseInput} py-1 text-sm`}>
          {TRACK_CODES.map((t) => (
            <option key={t} value={t}>
              {t} · {TRACKS[t].nombre}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={botonPequeno} disabled={pendiente}>
        Cambiar track
      </button>
      <div className="w-full">{aviso}</div>
    </form>
  );
}

export function FormInvitar() {
  const { pendiente, correr, aviso } = useAccion();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const correo = String(new FormData(form).get("correo"));
        correr(async () => {
          const r = await invitar(correo);
          if (r.ok) form.reset();
          return r;
        });
      }}
    >
      <div className="grid min-w-0 flex-1 gap-1">
        <label htmlFor="correo-invitar" className="text-sm font-medium">
          Invitar por correo
        </label>
        <input id="correo-invitar" name="correo" type="email" required autoComplete="off" className={`${claseInput} py-1 text-sm`} />
      </div>
      <button type="submit" className={botonPequeno} disabled={pendiente}>
        Enviar invitación
      </button>
      <div className="w-full">{aviso}</div>
    </form>
  );
}

export function FormUnirme() {
  const { pendiente, correr, aviso } = useAccion();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const codigo = String(new FormData(e.currentTarget).get("codigo"));
        correr(() => unirme(codigo));
      }}
    >
      <div className="grid gap-1">
        <label htmlFor="codigo-unirme" className="text-sm font-medium">
          Código de invitación
        </label>
        <input id="codigo-unirme" name="codigo" maxLength={6} autoComplete="off" className={`${claseInput} py-1 font-mono uppercase tracking-widest`} />
      </div>
      <button type="submit" className={botonPequeno} disabled={pendiente}>
        Unirme al equipo
      </button>
      <div className="w-full">{aviso}</div>
    </form>
  );
}

export function BotonEliminacion() {
  const { pendiente, correr, aviso } = useAccion();
  const [confirmando, setConfirmando] = useState(false);
  return (
    <div className="grid gap-2">
      {!confirmando ? (
        <button type="button" className={botonPequeno} onClick={() => setConfirmando(true)}>
          Solicitar la eliminación de mis datos
        </button>
      ) : (
        <div className="grid gap-2 rounded border border-danger p-3">
          <p className="text-sm">
            Si eliminamos tus datos, dejarás de participar en el hackathon y no podremos emitir tu certificado. ¿Confirmas la
            solicitud?
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${botonPequeno} border-danger`} disabled={pendiente} onClick={() => correr(solicitarEliminacion)}>
              Sí, solicitar eliminación
            </button>
            <button type="button" className={botonPequeno} onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {aviso}
    </div>
  );
}
