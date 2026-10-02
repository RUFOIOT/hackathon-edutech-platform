"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink, signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { CORREO_PENDIENTE_KEY } from "@/lib/auth/constantes";

type Estado = "verificando" | "pedir-correo" | "error" | "reenviado";

/** Traduce los errores de Firebase a qué pasó y qué hacer (no mostrar "auth/…" al usuario). */
function explicar(err: unknown): { mensaje: string; otroCorreo: boolean } {
  const codigo = (err as { code?: string } | null)?.code ?? "";
  if (codigo === "auth/invalid-action-code" || codigo === "auth/expired-action-code") {
    return {
      mensaje: "Este enlace ya se usó, venció o no es el último que pediste: cada enlace sirve una sola vez y solo vale el más reciente.",
      otroCorreo: true,
    };
  }
  if (codigo === "auth/invalid-email") {
    return { mensaje: "El correo no coincide con el del enlace. Escribe el correo al que llegó.", otroCorreo: true };
  }
  if (codigo === "auth/network-request-failed") return { mensaje: "Sin conexión. Revisa tu internet y vuelve a abrir el enlace.", otroCorreo: false };
  return { mensaje: err instanceof Error && !err.message.startsWith("Firebase") ? err.message : "No pudimos iniciar tu sesión.", otroCorreo: false };
}

/**
 * Destino del enlace mágico: completa el inicio de sesión en Firebase, cambia el ID token por una
 * cookie de sesión del servidor y cierra la sesión del SDK cliente (la fuente de verdad es la cookie).
 */
export default function Verificar() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [mensaje, setMensaje] = useState("");
  const [correoUsado, setCorreoUsado] = useState<string | null>(null);
  const [otroCorreo, setOtroCorreo] = useState(false);
  const iniciado = useRef(false);

  async function reenviar() {
    if (!correoUsado) return;
    const url = new URL("/auth/verificar", window.location.origin);
    const siguiente = new URL(window.location.href).searchParams.get("siguiente");
    if (siguiente) url.searchParams.set("siguiente", siguiente);
    try {
      await sendSignInLinkToEmail(clientAuth(), correoUsado, { url: url.toString(), handleCodeInApp: true });
      window.localStorage.setItem(CORREO_PENDIENTE_KEY, correoUsado);
      setEstado("reenviado");
    } catch {
      setMensaje("No pudimos enviar el enlace nuevo. Inténtalo desde la página de ingreso.");
    }
  }

  async function completar(correo: string) {
    setEstado("verificando");
    setCorreoUsado(correo);
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
      const e = explicar(err);
      setMensaje(e.mensaje);
      setOtroCorreo(e.otroCorreo);
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
        <div className="mt-4 grid gap-4">
          <p role="alert" className="text-danger">
            {mensaje}
          </p>
          <div className="flex flex-wrap gap-3">
            {correoUsado && (
              <button type="button" onClick={() => void reenviar()} className="rounded bg-accent px-5 py-3 font-medium text-on-accent">
                Enviarme un enlace nuevo a {correoUsado}
              </button>
            )}
            {otroCorreo && (
              <button type="button" onClick={() => setEstado("pedir-correo")} className="rounded border border-border px-5 py-3 font-medium">
                Pedí el enlace con otro correo
              </button>
            )}
            <Link href="/ingresar" className="self-center underline">
              Volver a ingresar
            </Link>
          </div>
        </div>
      )}
      {estado === "reenviado" && (
        <p role="status" className="mt-4 rounded border border-positive bg-surface p-4">
          Te enviamos un enlace nuevo a <strong>{correoUsado}</strong>. Ábrelo en este mismo navegador; los anteriores ya no sirven.
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
