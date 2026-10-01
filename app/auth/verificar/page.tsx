"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isSignInWithEmailLink, signInWithEmailLink, signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { CORREO_PENDIENTE_KEY } from "@/lib/auth/constantes";

type Estado = "verificando" | "pedir-correo" | "error";

/**
 * Destino del enlace mágico: completa el inicio de sesión en Firebase, cambia el ID token por una
 * cookie de sesión del servidor y cierra la sesión del SDK cliente (la fuente de verdad es la cookie).
 */
export default function Verificar() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [mensaje, setMensaje] = useState("");
  const iniciado = useRef(false);

  async function completar(correo: string) {
    setEstado("verificando");
    try {
      const href = window.location.href;
      const cred = await signInWithEmailLink(clientAuth(), correo, href);
      const idToken = await cred.user.getIdToken();
      const siguiente = new URL(href).searchParams.get("siguiente");
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, siguiente }),
      });
      await signOut(clientAuth());
      window.localStorage.removeItem(CORREO_PENDIENTE_KEY);
      const data = (await res.json()) as { destino?: string; error?: string };
      if (!res.ok || !data.destino) throw new Error(data.error ?? "No pudimos iniciar tu sesión.");
      router.replace(data.destino);
      router.refresh();
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "El enlace no es válido o ya fue usado.");
      setEstado("error");
    }
  }

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    if (!isSignInWithEmailLink(clientAuth(), window.location.href)) {
      setMensaje("Este enlace no es válido. Pide uno nuevo desde la página de ingreso.");
      setEstado("error");
      return;
    }
    const correo = window.localStorage.getItem(CORREO_PENDIENTE_KEY);
    if (correo) void completar(correo);
    else setEstado("pedir-correo"); // Abrió el enlace en otro dispositivo o navegador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">Verificando tu enlace</h1>
      {estado === "verificando" && <p role="status" className="mt-4 text-muted">Un momento, estamos iniciando tu sesión…</p>}
      {estado === "error" && (
        <p role="alert" className="mt-4 text-danger">
          {mensaje} <Link href="/ingresar" className="underline">Volver a ingresar</Link>
        </p>
      )}
      {estado === "pedir-correo" && (
        <form className="mt-6 grid gap-3" action={(fd) => void completar(String(fd.get("correo") ?? "").trim())}>
          <label htmlFor="correo" className="font-medium">
            Confirma el correo al que llegó el enlace
          </label>
          <input id="correo" name="correo" type="email" autoComplete="email" required className="rounded border border-border bg-surface px-3 py-2" />
          <button type="submit" className="rounded bg-accent px-5 py-3 font-medium text-on-accent">
            Confirmar y entrar
          </button>
        </form>
      )}
    </section>
  );
}
