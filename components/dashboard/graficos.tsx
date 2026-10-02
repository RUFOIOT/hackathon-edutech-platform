"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Gráficos del dashboard (Recharts). Sin decoración: rejilla tenue, un solo color de serie
 * (teal para datos) y la tabla equivalente oculta visualmente para lectores de pantalla.
 */
const COLOR = "var(--color-positive)";

function TablaAccesible({ titulo, filas, clave, valor }: { titulo: string; filas: Record<string, unknown>[]; clave: string; valor: string }) {
  return (
    <table className="sr-only">
      <caption>{titulo}</caption>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i}>
            <th scope="row">{String(f[clave])}</th>
            <td>{String(f[valor])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Linea({ titulo, datos, x, y }: { titulo: string; datos: Record<string, unknown>[]; x: string; y: string }) {
  return (
    <figure className="rounded border border-border bg-surface p-4">
      <figcaption className="text-sm font-medium">{titulo}</figcaption>
      {datos.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Sin datos todavía.</p>
      ) : (
        <div className="mt-3 h-48" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey={x} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey={y} stroke={COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <TablaAccesible titulo={titulo} filas={datos} clave={x} valor={y} />
    </figure>
  );
}

export function Barras({ titulo, datos }: { titulo: string; datos: Record<string, number> }) {
  const filas = Object.entries(datos).map(([nombre, n]) => ({ nombre, n }));
  return (
    <figure className="rounded border border-border bg-surface p-4">
      <figcaption className="text-sm font-medium">{titulo}</figcaption>
      <div className="mt-3 h-40" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filas} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="n" fill={COLOR} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TablaAccesible titulo={titulo} filas={filas} clave="nombre" valor="n" />
    </figure>
  );
}
