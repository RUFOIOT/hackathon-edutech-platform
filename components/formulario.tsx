import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * Primitivas de formulario accesibles: label asociado, ayuda y error enlazados con
 * aria-describedby, aria-invalid cuando hay error. Los errores dicen qué pasó y cómo corregirlo.
 */
export const claseInput =
  "w-full rounded border border-border bg-surface px-3 py-2 aria-[invalid=true]:border-danger aria-[invalid=true]:outline-danger";

function describedBy(id: string, ayuda?: ReactNode, error?: string) {
  return [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

export function Ayuda({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={`${id}-ayuda`} className="text-sm text-muted">
      {children}
    </p>
  );
}

export function MensajeError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="text-sm font-medium text-danger">
      {error}
    </p>
  );
}

type Base = { id: string; etiqueta: string; error?: string; ayuda?: ReactNode; opcional?: boolean };

function Etiqueta({ id, etiqueta, opcional }: Pick<Base, "id" | "etiqueta" | "opcional">) {
  return (
    <label htmlFor={id} className="font-medium">
      {etiqueta}
      {opcional && <span className="font-normal text-muted"> (opcional)</span>}
    </label>
  );
}

export function CampoTexto({ id, etiqueta, error, ayuda, opcional, ...props }: Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="grid gap-1.5">
      <Etiqueta id={id} etiqueta={etiqueta} opcional={opcional} />
      {ayuda && <Ayuda id={id}>{ayuda}</Ayuda>}
      <input
        id={id}
        name={props.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, ayuda, error)}
        required={!opcional}
        className={claseInput}
        {...props}
      />
      <MensajeError id={id} error={error} />
    </div>
  );
}

export function CampoArea({ id, etiqueta, error, ayuda, opcional, ...props }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="grid gap-1.5">
      <Etiqueta id={id} etiqueta={etiqueta} opcional={opcional} />
      {ayuda && <Ayuda id={id}>{ayuda}</Ayuda>}
      <textarea
        id={id}
        name={props.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, ayuda, error)}
        required={!opcional}
        className={claseInput}
        rows={3}
        {...props}
      />
      <MensajeError id={id} error={error} />
    </div>
  );
}

export function CampoSelect({
  id,
  etiqueta,
  error,
  ayuda,
  opcional,
  opciones,
  ...props
}: Base & SelectHTMLAttributes<HTMLSelectElement> & { opciones: readonly { valor: string; etiqueta: string }[] }) {
  return (
    <div className="grid gap-1.5">
      <Etiqueta id={id} etiqueta={etiqueta} opcional={opcional} />
      {ayuda && <Ayuda id={id}>{ayuda}</Ayuda>}
      <select
        id={id}
        name={props.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, ayuda, error)}
        required={!opcional}
        className={claseInput}
        {...props}
      >
        <option value="">Elige una opción</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
      <MensajeError id={id} error={error} />
    </div>
  );
}

/** Grupo de radios o casillas con leyenda (fieldset). */
export function Grupo({
  id,
  leyenda,
  error,
  ayuda,
  children,
}: {
  id: string;
  leyenda: string;
  error?: string;
  ayuda?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset id={id} className="grid gap-2" aria-describedby={describedBy(id, ayuda, error)}>
      <legend className="mb-1 font-medium">{leyenda}</legend>
      {ayuda && <Ayuda id={id}>{ayuda}</Ayuda>}
      {children}
      <MensajeError id={id} error={error} />
    </fieldset>
  );
}

export function Opcion({
  tipo = "radio",
  name,
  valor,
  etiqueta,
  descripcion,
  ...props
}: {
  tipo?: "radio" | "checkbox";
  name: string;
  valor: string;
  etiqueta: ReactNode;
  descripcion?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = `${name}-${valor}`;
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer gap-3 rounded border border-border bg-surface p-3 has-[:checked]:border-2 has-[:checked]:border-navy-700"
    >
      <input id={id} type={tipo} name={name} value={valor} className="mt-1 accent-navy-700" {...props} />
      <span>
        <span className="font-medium">{etiqueta}</span>
        {descripcion && <span className="block text-sm text-muted">{descripcion}</span>}
      </span>
    </label>
  );
}

export function ResumenErrores({ errores }: { errores: Record<string, string> }) {
  const lista = Object.entries(errores);
  if (lista.length === 0) return null;
  return (
    <div role="alert" className="rounded border-2 border-danger bg-surface p-4">
      <p className="font-semibold">{lista.length === 1 ? "Revisa este dato:" : `Revisa estos ${lista.length} datos:`}</p>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {lista.map(([campo, msg]) => (
          <li key={campo}>
            {campo === "_" ? (
              msg
            ) : (
              <a href={`#${campo.replace(/\./g, "-")}`} className="underline">
                {msg}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
