"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ResultadoAccion } from "@/components/admin/accion";
import { claseInput } from "@/components/formulario";
import { registrarCheckin } from "@/lib/admin/acciones";

interface Persona {
  id: string;
  nombre: string;
  equipo: string;
  categoria: string;
  presente: boolean;
}

/** Escáner de QR (@zxing/browser, cámara del celular) y búsqueda manual como respaldo. */
export function Checkin({ personas }: { personas: Persona[] }) {
  const [r, setR] = useState<ResultadoAccion | null>(null);
  const [q, setQ] = useState("");
  const [escaneando, setEscaneando] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  const ultimo = useRef<{ texto: string; t: number }>({ texto: "", t: 0 });

  useEffect(() => {
    if (!escaneando || !video.current) return;
    let detener: (() => void) | null = null;
    let activo = true;
    (async () => {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      try {
        const controles = await new BrowserQRCodeReader().decodeFromVideoDevice(undefined, video.current!, (resultado) => {
          if (!resultado || !activo) return;
          const texto = resultado.getText();
          // Evita registrar el mismo QR varias veces mientras sigue frente a la cámara.
          if (texto === ultimo.current.texto && Date.now() - ultimo.current.t < 4000) return;
          ultimo.current = { texto, t: Date.now() };
          iniciar(async () => setR(await registrarCheckin({ token: texto })));
        });
        detener = () => controles.stop();
      } catch {
        setR({ ok: false, error: "No pudimos abrir la cámara. Da permiso o usa la búsqueda manual." });
        setEscaneando(false);
      }
    })();
    return () => {
      activo = false;
      detener?.();
    };
  }, [escaneando]);

  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t.length < 2 ? [] : personas.filter((p) => `${p.nombre} ${p.equipo}`.toLowerCase().includes(t)).slice(0, 8);
  }, [q, personas]);

  return (
    <div className="grid gap-6">
      {r && (
        <p role={r.ok ? "status" : "alert"} className={`rounded border-2 p-4 text-lg font-semibold ${r.ok ? "border-positive" : "border-danger text-danger"}`}>
          {r.ok ? r.mensaje : r.error}
        </p>
      )}
      <section aria-labelledby="qr" className="grid gap-3">
        <h2 id="qr" className="text-lg font-semibold">
          Escanear QR
        </h2>
        <button type="button" onClick={() => setEscaneando((x) => !x)} className="justify-self-start rounded bg-accent px-5 py-3 font-medium text-on-accent">
          {escaneando ? "Detener cámara" : "Abrir cámara"}
        </button>
        {escaneando && (
          <video ref={video} className="aspect-square w-full max-w-sm rounded border border-border bg-navy-900 object-cover" muted playsInline aria-label="Vista de la cámara" />
        )}
      </section>
      <section aria-labelledby="manual" className="grid gap-3">
        <h2 id="manual" className="text-lg font-semibold">
          Búsqueda manual
        </h2>
        <label htmlFor="buscar" className="sr-only">
          Buscar por nombre o equipo
        </label>
        <input id="buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o equipo (mínimo 2 letras)" className={claseInput} autoComplete="off" />
        <ul className="grid gap-2">
          {resultados.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 rounded border border-border bg-surface p-3">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{p.nombre}</span>
                <span className="text-sm text-muted">
                  {p.equipo} · {p.categoria === "JUNIOR" ? "Junior" : "Open"}
                </span>
              </span>
              {p.presente ? (
                <span className="text-sm font-medium text-positive-text">Ya presente</span>
              ) : (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => iniciar(async () => setR(await registrarCheckin({ participantId: p.id })))}
                  className="rounded border border-border px-3 py-2 text-sm font-medium"
                >
                  Registrar check-in
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
