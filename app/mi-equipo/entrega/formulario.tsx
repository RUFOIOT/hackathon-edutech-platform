"use client";

import { useState, useTransition } from "react";
import { CampoTexto, Grupo, Opcion, ResumenErrores, claseInput } from "@/components/formulario";
import { validarPitch } from "@/lib/validation/entrega";
import { entregar, iniciarSubidaPitch, subirPitch, type RespuestaEntrega } from "./acciones";

type Errores = Record<string, string>;

const DECLARACIONES = [
  { name: "datosSinteticos", texto: "Usamos solo datos sintéticos o anonimizados: ningún dato real de estudiantes, familias o docentes." },
  { name: "priorWork", texto: "Declaramos en PRIOR_WORK.md todo lo que no escribimos durante el evento." },
  { name: "aiUsage", texto: "Declaramos en AI_USAGE.md qué herramientas de IA usamos y para qué." },
] as const;

export function FormEntrega({ repoUrl, demoPrevia, pitchSubido }: { repoUrl: string; demoPrevia: string | null; pitchSubido: boolean }) {
  const [modo, setModo] = useState<"url" | "local">(demoPrevia === "ejecucion-local" ? "local" : "url");
  const [errores, setErrores] = useState<Errores>({});
  const [etapa, setEtapa] = useState<string | null>(null);
  const [exito, setExito] = useState<Extract<RespuestaEntrega, { ok: true }> | null>(null);
  const [pendiente, iniciar] = useTransition();

  async function subir(archivo: File): Promise<string | null> {
    const e = validarPitch(archivo.name, archivo.type, archivo.size);
    if (e) return e;
    setEtapa("Subiendo el PDF del pitch…");
    const ini = await iniciarSubidaPitch();
    if (!ini.ok) return Object.values(ini.errores)[0] ?? "No pudimos preparar la subida.";
    if (ini.modo === "firmada") {
      const res = await fetch(ini.url, { method: "PUT", headers: ini.cabeceras, body: archivo });
      return res.ok ? null : "No pudimos subir el PDF. Revisa tu conexión e inténtalo de nuevo.";
    }
    const fd = new FormData();
    fd.set("pitch", archivo);
    const r = await subirPitch(fd);
    return r.ok ? null : (Object.values(r.errores)[0] ?? "No pudimos subir el PDF.");
  }

  if (exito) {
    return (
      <div role="status" className="rounded border-2 border-positive bg-surface p-5">
        <p className="text-lg font-semibold">Proyecto entregado</p>
        <p className="mt-2">El jurado evaluará este commit:</p>
        <p className="mt-1 break-all font-mono text-lg">{exito.tagSha}</p>
        <p className="mt-2 text-sm text-muted">
          Fecha del commit: {new Date(exito.tagCommitAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })} (hora de Ecuador). Te
          enviamos un correo con este hash. Si mueves el tag entrega después de las 12:00, el sistema lo detecta y el comité revisa el caso.
        </p>
        <button type="button" onClick={() => setExito(null)} className="mt-4 text-sm underline">
          Volver a entregar (antes del code freeze)
        </button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const archivo = fd.get("pitch");
        iniciar(async () => {
          setErrores({});
          if (archivo instanceof File && archivo.size > 0) {
            const error = await subir(archivo);
            if (error) {
              setEtapa(null);
              setErrores({ pitch: error });
              return;
            }
          } else if (!pitchSubido) {
            setErrores({ pitch: "Adjunta el PDF del pitch." });
            return;
          }
          setEtapa("Consultando el tag entrega en GitHub…");
          const r = await entregar({
            modoDemo: fd.get("modoDemo") ?? undefined,
            demoUrl: String(fd.get("demoUrl") ?? ""),
            videoUrl: String(fd.get("videoUrl") ?? ""),
            datosSinteticos: fd.get("datosSinteticos") === "on",
            priorWork: fd.get("priorWork") === "on",
            aiUsage: fd.get("aiUsage") === "on",
          });
          setEtapa(null);
          if (r.ok) setExito(r);
          else setErrores(r.errores);
        });
      }}
    >
      <ResumenErrores errores={errores} />
      <CampoTexto
        id="repo"
        etiqueta="Repositorio"
        value={repoUrl}
        readOnly
        ayuda="El registrado en la pestaña Repositorio."
        className={`${claseInput} text-muted`}
      />

      <Grupo id="modoDemo" leyenda="Demo" error={errores.modoDemo}>
        <Opcion name="modoDemo" valor="url" etiqueta="Está desplegada" descripcion="Pega el enlace público." checked={modo === "url"} onChange={() => setModo("url")} />
        <Opcion
          name="modoDemo"
          valor="local"
          etiqueta="Ejecución local"
          descripcion="El README explica cómo correrla."
          checked={modo === "local"}
          onChange={() => setModo("local")}
        />
      </Grupo>
      {modo === "url" && (
        <CampoTexto
          id="demoUrl"
          etiqueta="Enlace a la demo"
          type="url"
          placeholder="https://"
          defaultValue={demoPrevia && demoPrevia !== "ejecucion-local" ? demoPrevia : ""}
          error={errores.demoUrl}
        />
      )}

      <CampoTexto
        id="pitch"
        etiqueta="PDF del pitch (máximo 20 MB)"
        type="file"
        accept="application/pdf,.pdf"
        opcional={pitchSubido}
        ayuda={pitchSubido ? "Ya subiste un PDF. Adjunta otro solo si quieres reemplazarlo." : undefined}
        error={errores.pitch}
      />
      <CampoTexto
        id="videoUrl"
        etiqueta="Video de respaldo (enlace)"
        type="url"
        opcional
        placeholder="https://"
        error={errores.videoUrl}
        ayuda="Solo se usa si la mesa técnica confirma una falla de conectividad."
      />

      <Grupo id="declaraciones" leyenda="Declaraciones obligatorias">
        {DECLARACIONES.map((d) => (
          <div key={d.name}>
            <label className="flex items-start gap-2">
              <input id={d.name} type="checkbox" name={d.name} aria-invalid={errores[d.name] ? true : undefined} className="mt-1 accent-navy-700" />
              <span>{d.texto}</span>
            </label>
            {errores[d.name] && <p className="mt-1 text-sm font-medium text-danger">{errores[d.name]}</p>}
          </div>
        ))}
      </Grupo>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pendiente} className="rounded bg-accent px-5 py-3 font-medium text-on-accent disabled:opacity-60">
          {pendiente ? "Entregando…" : "Entregar proyecto"}
        </button>
        {etapa && (
          <p role="status" className="text-sm text-muted">
            {etapa}
          </p>
        )}
      </div>
    </form>
  );
}
