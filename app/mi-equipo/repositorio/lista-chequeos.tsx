import type { Chequeo } from "@/lib/github";

/** Resultado de cada validación con texto claro (no solo color): "Cumple" / "No cumple". */
export function ListaChequeos({ chequeos }: { chequeos: Chequeo[] }) {
  return (
    <ul className="grid gap-2">
      {chequeos.map((c) => (
        <li key={c.id} className="flex gap-3 rounded border border-border bg-surface p-3 text-sm">
          <span className={`shrink-0 font-semibold ${c.ok ? "text-positive-text" : "text-danger"}`}>{c.ok ? "Cumple" : "No cumple"}</span>
          <span>{c.mensaje}</span>
        </li>
      ))}
    </ul>
  );
}
