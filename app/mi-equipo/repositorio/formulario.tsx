"use client";

import { useState, useTransition } from "react";
import { CampoTexto } from "@/components/formulario";
import { ListaChequeos } from "./lista-chequeos";
import { actualizarMetricas, registrar, type RespuestaRepo } from "./acciones";

export function FormRepositorio({ urlActual, esperado }: { urlActual: string; esperado: string }) {
  const [r, setR] = useState<RespuestaRepo | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const url = String(new FormData(e.currentTarget).get("url"));
        iniciar(async () => setR(await registrar(url)));
      }}
    >
      <CampoTexto
        id="url"
        etiqueta="URL del repositorio"
        type="url"
        defaultValue={urlActual}
        placeholder={`https://github.com/eight-academy-hackathon/${esperado}`}
        ayuda={`Nombre esperado para tu equipo: ${esperado}`}
        autoComplete="off"
        spellCheck={false}
        error={r && !r.ok ? r.error : undefined}
      />
      <div>
        <button type="submit" disabled={pendiente} className="rounded bg-accent px-5 py-3 font-medium text-on-accent disabled:opacity-60">
          {pendiente ? "Validando con GitHub…" : "Registrar repositorio"}
        </button>
      </div>
      {r?.ok && (
        <div role="status" className="grid gap-3">
          <p className={`font-medium ${r.valido ? "text-positive-text" : "text-danger"}`}>
            {r.valido ? "Repositorio registrado y validado." : "El repositorio no cumple todas las validaciones. Corrige lo marcado y vuelve a registrarlo."}
          </p>
          <ListaChequeos chequeos={r.chequeos} />
        </div>
      )}
    </form>
  );
}

export function BotonActualizar() {
  const [m, setM] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => iniciar(async () => setM(await actualizarMetricas()))}
        className="justify-self-start rounded border border-border bg-surface px-3 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pendiente ? "Consultando GitHub…" : "Actualizar métricas ahora"}
      </button>
      {m && (
        <p role="status" className={`text-sm ${m.ok ? "text-positive-text" : "text-muted"}`}>
          {m.mensaje}
        </p>
      )}
    </div>
  );
}
