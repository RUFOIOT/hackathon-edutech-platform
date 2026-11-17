"use client";

import { createElement, useEffect, useRef, type ReactNode } from "react";

/** subir (por defecto), escala, izquierda, derecha, o escalonado: anima a los hijos directos uno tras otro. */
export type VarianteRevelar = "subir" | "escala" | "izquierda" | "derecha" | "escalonado";

/**
 * Revela su contenido cuando entra en pantalla (clase .revelar en globals.css). El contenido solo
 * se oculta si hay JavaScript y sin prefers-reduced-motion; si el navegador no tiene
 * IntersectionObserver, aparece de inmediato.
 */
export function Revelar({
  children,
  className = "",
  retraso = 0,
  variante = "subir",
  como = "div",
}: {
  children: ReactNode;
  className?: string;
  retraso?: number;
  variante?: VarianteRevelar;
  /** Etiqueta del contenedor: usa ul, ol o dl para escalonar una lista sin envolverla. */
  como?: "div" | "ul" | "ol" | "dl";
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.visible = "true";
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          el.dataset.visible = "true";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return createElement(
    como,
    {
      ref,
      className: `revelar ${className}`,
      "data-variante": variante === "subir" ? undefined : variante,
      style: retraso ? { transitionDelay: `${retraso}ms` } : undefined,
    },
    children,
  );
}
