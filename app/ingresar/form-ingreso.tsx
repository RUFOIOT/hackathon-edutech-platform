"use client";

import { useState } from "react";
import { sendSignInLinkToEmail } from "firebase/auth";
import { z } from "zod";
import { clientAuth } from "@/lib/firebase/client";
import { CORREO_PENDIENTE_KEY } from "@/lib/auth/constantes";

const correoSchema = z.email("Escribe un correo válido, por ejemplo nombre@dominio.com.");

type Estado = { tipo: "inicial" } | { tipo: "enviando" } | { tipo: "enviado"; correo: string } | { tipo: "error"; mensaje: string };

export function FormIngreso({ siguiente }: { siguiente: string | null }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });

  async function enviar(formData: FormData) {
    const parsed = correoSchema.safeParse(String(formData.get("correo") ?? "").trim());
    if (!parsed.success) {
      setEstado({ tipo: "error", mensaje: parsed.error.issues[0]?.message ?? "Correo inválido." });
      return;
    }
    setEstado({ tipo: "enviando" });
    const url = new URL("/auth/verificar", window.location.origin);
    if (siguiente) url.searchParams.set("siguiente", siguiente);
    try {
      await sendSignInLinkToEmail(clientAuth(), parsed.data, { url: url.toString(), handleCodeInApp: true });
      window.localStorage.setItem(CORREO_PENDIENTE_KEY, parsed.data);
      setEstado({ tipo: "enviado", correo: parsed.data });
    } catch {
      setEstado({ tipo: "error", mensaje: "No pudimos enviar el enlace. Revisa tu conexión e inténtalo de nuevo." });
    }
  }

  if (estado.tipo === "enviado") {
    return (
      <p role="status" className="mt-8 rounded border border-positive bg-surface p-4">
        Enlace enviado a <strong>{estado.correo}</strong>. Revisa tu bandeja de entrada y la carpeta de spam.
      </p>
    );
  }

  return (
    <form action={enviar} className="mt-8 grid gap-3" noValidate>
      <label htmlFor="correo" className="font-medium">
        Correo electrónico
      </label>
      <input
        id="correo"
        name="correo"
        type="email"
        autoComplete="email"
        required
        aria-invalid={estado.tipo === "error"}
        aria-describedby={estado.tipo === "error" ? "correo-error" : undefined}
        className="rounded border border-border bg-surface px-3 py-2"
      />
      {estado.tipo === "error" && (
        <p id="correo-error" role="alert" className="text-sm text-danger">
          {estado.mensaje}
        </p>
      )}
      <button
        type="submit"
        disabled={estado.tipo === "enviando"}
        className="mt-2 rounded bg-accent px-5 py-3 font-medium text-on-accent disabled:opacity-60"
      >
        {estado.tipo === "enviando" ? "Enviando enlace…" : "Enviarme el enlace"}
      </button>
    </form>
  );
}
