import Link from "next/link";

/** Pestañas del portal del equipo. Cada página verifica la sesión y el equipo por su cuenta. */
const PESTANAS = [
  { href: "/mi-equipo", nombre: "Mi equipo" },
  { href: "/mi-equipo/repositorio", nombre: "Repositorio" },
  { href: "/mi-equipo/entrega", nombre: "Entregar proyecto" },
];

export default function LayoutMiEquipo({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav aria-label="Portal del equipo" className="border-b border-border bg-surface">
        <ul className="mx-auto flex max-w-4xl flex-wrap gap-x-6 gap-y-1 px-4 py-2 text-sm">
          {PESTANAS.map((p) => (
            <li key={p.href}>
              <Link href={p.href} className="underline-offset-4 hover:underline">
                {p.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </>
  );
}
