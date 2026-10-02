"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Revela su contenido con un desplazamiento suave cuando entra en pantalla (clase .revelar en
 * globals.css). Con prefers-reduced-motion el contenido aparece directamente.
 */
export function Revelar({ children, className = "", retraso = 0 }: { children: ReactNode; className?: string; retraso?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
  return (
    <div ref={ref} className={`revelar ${className}`} style={retraso ? { transitionDelay: `${retraso}ms` } : undefined}>
      {children}
    </div>
  );
}
