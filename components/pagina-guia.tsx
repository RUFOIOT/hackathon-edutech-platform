import type { Documento, Encabezado } from "@/lib/content/markdown";

function ListaIndice({ indice }: { indice: Encabezado[] }) {
  return (
    <ul className="grid gap-1.5 text-sm">
      {indice.map((h) => (
        <li key={h.id} className={h.nivel === 3 ? "pl-3" : undefined}>
          <a href={`#${h.id}`} className="text-muted hover:text-fg hover:underline">
            {h.texto}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Página de una guía: índice lateral fijo en escritorio y desplegable en móvil.
 * El HTML viene de content/*.md (contenido propio del repositorio, no de usuarios).
 */
export function PaginaGuia({ doc, descripcion }: { doc: Documento; descripcion?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:grid lg:grid-cols-[15rem_1fr] lg:gap-12">
      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto">
        <nav aria-label="Contenido de esta guía">
          <details className="rounded border border-border bg-surface p-3 lg:hidden">
            <summary className="cursor-pointer font-medium">Contenido de esta guía</summary>
            <div className="mt-3">
              <ListaIndice indice={doc.indice} />
            </div>
          </details>
          <div className="hidden lg:block">
            <p className="mb-3 text-sm font-medium">En esta guía</p>
            <ListaIndice indice={doc.indice} />
          </div>
        </nav>
      </aside>
      <article className="mt-8 min-w-0 lg:mt-0">
        <h1 className="max-w-[28ch] text-2xl font-semibold sm:text-4xl">{doc.titulo}</h1>
        {descripcion && <p className="mt-3 max-w-prose text-muted">{descripcion}</p>}
        <div className="prosa mt-8" dangerouslySetInnerHTML={{ __html: doc.html }} />
      </article>
    </div>
  );
}
