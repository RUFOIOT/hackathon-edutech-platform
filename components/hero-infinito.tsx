"use client";

import { useEffect, useState } from "react";
import { restante, restanteEnPalabras, type Restante } from "@/lib/event/countdown";

/**
 * Lemniscata de Bernoulli calculada una sola vez: x = a·cos t / (1 + sin² t), y = a·sin t·cos t / (1 + sin² t).
 * viewBox 400×180, centro (200, 90). Los centros de los lazos quedan en x ≈ 73 y x ≈ 327 (18 % y 82 %).
 */
const TRAZO = (() => {
  const a = 180;
  const puntos: string[] = [];
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * 2 * Math.PI;
    const d = 1 + Math.sin(t) ** 2;
    const x = 200 + (a * Math.cos(t)) / d;
    const y = 90 + (a * Math.sin(t) * Math.cos(t)) / d;
    puntos.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${puntos.join(" ")} Z`;
})();

const dos = (n: number) => String(n).padStart(2, "0");

/**
 * Cuenta regresiva al kick-off dentro del infinito. El servidor pinta guiones del mismo ancho
 * (sin salto de diseño); el navegador calcula con su reloj, que es una resta de instantes y no
 * depende de su zona horaria.
 */
export function HeroInfinito({ objetivoIso, etiquetaObjetivo }: { objetivoIso: string; etiquetaObjetivo: string }) {
  const [r, setR] = useState<Restante | null>(null);

  useEffect(() => {
    const objetivo = new Date(objetivoIso);
    const tick = () => setR(restante(objetivo, new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [objetivoIso]);

  return (
    <div role="timer" aria-labelledby="cuenta-titulo" className="mx-auto w-full max-w-3xl">
      <p id="cuenta-titulo" className="text-center text-sm opacity-80">
        Kick-off: {etiquetaObjetivo} (hora de Ecuador)
      </p>
      <div className="relative mt-3 aspect-[400/180] w-full">
        <svg viewBox="0 0 400 180" className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
          {/* Los cuatro tramos del infinito con los colores del logo de Eight Academy. */}
          {["var(--color-ocho-azul)", "var(--color-ocho-ambar)", "var(--color-ocho-rosa)", "var(--color-ocho-verde)"].map((color, i) => (
            <path
              key={color}
              d={TRAZO}
              fill="none"
              pathLength={100}
              stroke={color}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray="23 77"
              strokeDashoffset={-25 * i - 1}
            />
          ))}
          {/* Destello que recorre el trazo: el único movimiento continuo del hero. */}
          <path d={TRAZO} fill="none" pathLength={100} className="trazo-infinito" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="4" strokeLinecap="round" />
        </svg>
        {r?.terminado ? (
          <p className="absolute inset-0 flex items-center justify-center font-display text-xl font-semibold">
            El hackathon está en marcha
          </p>
        ) : (
          <div aria-hidden="true" className="tabular-nums">
            <div className="absolute top-1/2 left-[18.25%] -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="block font-display text-2xl leading-none font-semibold sm:text-5xl">{r ? r.dias : "--"}</span>
              <span className="text-xs opacity-80 sm:text-sm">{r?.dias === 1 ? "día" : "días"}</span>
            </div>
            <div className="absolute top-1/2 left-[81.75%] -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="block font-display text-base leading-none font-semibold sm:text-3xl">
                {r ? `${dos(r.horas)}:${dos(r.minutos)}:${dos(r.segundos)}` : "--:--:--"}
              </span>
              <span className="text-xs opacity-80 sm:text-sm">h · min · s</span>
            </div>
          </div>
        )}
      </div>
      {/* Para lectores de pantalla: frase completa, sin anunciar cada segundo. */}
      <p className="sr-only">{r ? restanteEnPalabras(r) : `Kick-off el ${etiquetaObjetivo}.`}</p>
    </div>
  );
}
