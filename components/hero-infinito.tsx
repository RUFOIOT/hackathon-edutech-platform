"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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

/** Inclinación máxima del ocho, en grados, cuando el puntero llega al borde del hero. */
const INCLINACION_MAX = 9;
/** Profundidad en px de una capa del falso 3D (la usa .ocho-capa en globals.css). */
const z = (px: number) => ({ "--z": px }) as CSSProperties;

/**
 * Cuenta regresiva al kick-off dentro del infinito. El servidor pinta guiones del mismo ancho
 * (sin salto de diseño); el navegador calcula con su reloj, que es una resta de instantes y no
 * depende de su zona horaria.
 *
 * Falso 3D: el ocho son capas apiladas (sombra, trazo, destello y cifras) que se inclinan con el
 * puntero. Solo con mouse y sin prefers-reduced-motion; en táctil queda plano. Las capas se
 * transforman sin cambiar de tamaño, así que no hay salto de diseño.
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

  const escena = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = escena.current;
    const zona = el?.closest("section") ?? el;
    if (!el || !zona) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let cuadro = 0;
    const inclinar = (rx: number, ry: number) => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
        el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
      });
    };
    const alMover = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const caja = zona.getBoundingClientRect();
      const x = (e.clientX - caja.left) / caja.width - 0.5;
      const y = (e.clientY - caja.top) / caja.height - 0.5;
      inclinar(-y * 2 * INCLINACION_MAX, x * 2 * INCLINACION_MAX);
    };
    const alSalir = () => inclinar(0, 0);
    zona.addEventListener("pointermove", alMover);
    zona.addEventListener("pointerleave", alSalir);
    return () => {
      cancelAnimationFrame(cuadro);
      zona.removeEventListener("pointermove", alMover);
      zona.removeEventListener("pointerleave", alSalir);
    };
  }, []);

  return (
    <div role="timer" aria-labelledby="cuenta-titulo" className="mx-auto w-full max-w-3xl">
      <p id="cuenta-titulo" className="text-center text-sm opacity-80">
        Kick-off: {etiquetaObjetivo} (hora de Ecuador)
      </p>
      <div ref={escena} className="ocho-escena relative mt-3 aspect-[400/180] w-full">
        <div className="ocho-3d absolute inset-0">
          {/* Sombra del ocho, detrás del trazo: solo aparece cuando el 3D está activo. */}
          <svg viewBox="0 0 400 180" className="ocho-capa ocho-sombra absolute inset-0 h-full w-full" style={z(-48)} aria-hidden="true" focusable="false">
            <path d={TRAZO} fill="none" stroke="#050b1f" strokeOpacity="0.45" strokeWidth="13" strokeLinecap="round" transform="translate(0 7)" />
          </svg>
          <svg viewBox="0 0 400 180" className="ocho-capa absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
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
          </svg>
          {/* Destello que recorre el trazo: el único movimiento continuo del hero. */}
          <svg viewBox="0 0 400 180" className="ocho-capa absolute inset-0 h-full w-full" style={z(22)} aria-hidden="true" focusable="false">
            <path d={TRAZO} fill="none" pathLength={100} className="trazo-infinito" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="4" strokeLinecap="round" />
          </svg>
          {r?.terminado ? (
            <p className="ocho-capa absolute inset-0 flex items-center justify-center font-display text-xl font-semibold" style={z(44)}>
              El hackathon está en marcha
            </p>
          ) : (
            <div aria-hidden="true" className="ocho-capa absolute inset-0 tabular-nums" style={z(44)}>
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
      </div>
      {/* Para lectores de pantalla: frase completa, sin anunciar cada segundo. */}
      <p className="sr-only">{r ? restanteEnPalabras(r) : `Kick-off el ${etiquetaObjetivo}.`}</p>
    </div>
  );
}
