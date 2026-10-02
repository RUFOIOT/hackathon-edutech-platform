"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { clientAuth, clientDb } from "@/lib/firebase/client";

/**
 * Tiempo real del dashboard: escucha colecciones con onSnapshot y, ante un cambio, vuelve a
 * renderizar la página en el servidor (router.refresh), como máximo una vez cada `intervaloMs`.
 * Los KPIs se siguen calculando en el servidor con la misma función que se verifica en SQL.
 */
export function TiempoReal({ colecciones, intervaloMs = 8000 }: { colecciones: string[]; intervaloMs?: number }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"conectando" | "en-vivo" | "sin-conexion">("conectando");
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const ultimo = useRef(0);
  const pendiente = useRef<number | null>(null);
  const clave = colecciones.join(",");

  useEffect(() => {
    let cancelado = false;
    const cancelar: (() => void)[] = [];
    (async () => {
      try {
        const res = await fetch("/api/auth/token-cliente", { cache: "no-store" });
        if (!res.ok) throw new Error("sin token");
        const { token } = (await res.json()) as { token: string };
        await signInWithCustomToken(clientAuth(), token);
        if (cancelado) return;
        const refrescar = () => {
          if (pendiente.current !== null) return;
          const espera = Math.max(0, ultimo.current + intervaloMs - Date.now());
          pendiente.current = window.setTimeout(() => {
            pendiente.current = null;
            ultimo.current = Date.now();
            setActualizado(new Date());
            router.refresh();
          }, espera);
        };
        for (const c of clave.split(",")) {
          let primera = true;
          cancelar.push(
            onSnapshot(
              collection(clientDb(), c),
              () => {
                if (primera) primera = false; // la primera lectura es el estado actual
                else refrescar();
              },
              () => setEstado("sin-conexion"),
            ),
          );
        }
        setEstado("en-vivo");
      } catch {
        setEstado("sin-conexion");
      }
    })();
    return () => {
      cancelado = true;
      cancelar.forEach((f) => f());
      if (pendiente.current !== null) window.clearTimeout(pendiente.current);
    };
  }, [clave, intervaloMs, router]);

  return (
    <p role="status" className="text-sm text-muted">
      {estado === "en-vivo" && `Actualización en tiempo real activa${actualizado ? ` · último cambio ${actualizado.toLocaleTimeString("es-EC")}` : ""}.`}
      {estado === "conectando" && "Conectando la actualización en tiempo real…"}
      {estado === "sin-conexion" && "Sin actualización en tiempo real: recarga la página para ver datos nuevos."}
    </p>
  );
}
