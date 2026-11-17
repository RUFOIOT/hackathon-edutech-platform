"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Sección con animaciones continuas (manchas, cinta, destello del ocho). Cuando sale de pantalla
 * marca data-fuera y globals.css pausa esas animaciones: no gastan batería si nadie las ve.
 */
export function SeccionViva({ children, className, etiquetadaPor }: { children: ReactNode; className?: string; etiquetadaPor: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      if (e) el.dataset.fuera = String(!e.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section ref={ref} aria-labelledby={etiquetadaPor} className={className}>
      {children}
    </section>
  );
}
