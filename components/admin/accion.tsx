"use client";

import { useState, useTransition, type ReactNode } from "react";

export type ResultadoAccion = { ok: true; mensaje: string } | { ok: false; error: string };

function Aviso({ r }: { r: ResultadoAccion | null }) {
  if (!r) return null;
  return (
    <p role={r.ok ? "status" : "alert"} className={`text-sm ${r.ok ? "text-positive-text" : "font-medium text-danger"}`}>
      {r.ok ? r.mensaje : r.error}
    </p>
  );
}

const estiloBoton = {
  primario: "rounded bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-60",
  secundario: "rounded border border-border bg-surface px-3 py-1.5 text-sm font-medium disabled:opacity-60",
};

/** Botón que ejecuta una Server Action (ya enlazada con sus argumentos) y muestra el resultado. */
export function BotonAccion({
  accion,
  children,
  confirmar,
  variante = "secundario",
  etiquetaAccesible,
}: {
  accion: () => Promise<ResultadoAccion>;
  children: ReactNode;
  confirmar?: string;
  variante?: keyof typeof estiloBoton;
  etiquetaAccesible?: string;
}) {
  const [r, setR] = useState<ResultadoAccion | null>(null);
  const [armado, setArmado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const ejecutar = () => iniciar(async () => setR(await accion()));
  return (
    <span className="inline-grid gap-1">
      {confirmar && armado ? (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="text-sm">{confirmar}</span>
          <button
            type="button"
            className={estiloBoton.primario}
            disabled={pendiente}
            onClick={() => {
              setArmado(false);
              ejecutar();
            }}
          >
            Sí, confirmar
          </button>
          <button type="button" className={estiloBoton.secundario} onClick={() => setArmado(false)}>
            Cancelar
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-label={etiquetaAccesible}
          className={estiloBoton[variante]}
          disabled={pendiente}
          onClick={() => (confirmar ? setArmado(true) : ejecutar())}
        >
          {pendiente ? "…" : children}
        </button>
      )}
      <Aviso r={r} />
    </span>
  );
}

/** Formulario que envía su FormData a una Server Action y muestra el resultado. */
export function FormularioAccion({
  accion,
  children,
  etiqueta,
  className = "grid gap-3",
}: {
  accion: (fd: FormData) => Promise<ResultadoAccion>;
  children: ReactNode;
  etiqueta: string;
  className?: string;
}) {
  const [r, setR] = useState<ResultadoAccion | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        iniciar(async () => {
          const res = await accion(fd);
          setR(res);
          if (res.ok) form.reset();
        });
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={estiloBoton.primario} disabled={pendiente}>
          {pendiente ? "Guardando…" : etiqueta}
        </button>
        <Aviso r={r} />
      </div>
    </form>
  );
}
