"use client";

import { useEffect, useRef, useState } from "react";

const DURACION_MS = 900;

/** Escala cada número del texto: "2–5" a la mitad es "1–3". */
function enProgreso(texto: string, p: number): string {
  return texto.replace(/\d+/g, (n) => String(Math.round(Number(n) * p)));
}

/**
 * Cifra que cuenta desde cero cuando entra en pantalla. El servidor pinta el valor final, así que
 * sin JavaScript o con prefers-reduced-motion se lee tal cual. Los lectores de pantalla reciben
 * siempre el valor final.
 */
export function Cifra({ valor }: { valor: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [texto, setTexto] = useState(valor);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    let cuadro = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e) return;
      if (!e.isIntersecting) {
        // Aún no se ve: espera en cero.
        setTexto(enProgreso(valor, 0));
        return;
      }
      io.disconnect();
      const inicio = performance.now();
      const paso = (t: number) => {
        const p = Math.min(1, (t - inicio) / DURACION_MS);
        setTexto(enProgreso(valor, 1 - (1 - p) ** 3));
        if (p < 1) cuadro = requestAnimationFrame(paso);
      };
      cuadro = requestAnimationFrame(paso);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(cuadro);
    };
  }, [valor]);

  return (
    <span ref={ref}>
      <span aria-hidden="true">{texto}</span>
      <span className="sr-only">{valor}</span>
    </span>
  );
}
