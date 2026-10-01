"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { RUBRICA } from "@/lib/models/rubrica";
import { scoreTotal, type Niveles } from "@/lib/scoring";
import { CampoArea, Grupo, Opcion, ResumenErrores, claseInput } from "@/components/formulario";
import { enviarConflicto, enviarPuntaje } from "./acciones";

type Errores = Record<string, string>;
type Previo = Partial<Niveles> & { tiempoUsadoSeg?: number; demoEnVivo?: boolean; fortaleza?: string; recomendacion?: string };

/**
 * Hoja de evaluación (rúbrica §9), pensada para celular: primero la declaración de conflicto,
 * luego los 6 criterios con sus descriptores visibles, tiempo, demo, fortaleza y recomendación.
 * El total se calcula en vivo con la misma función que usa el servidor (lib/scoring.ts).
 */
export function HojaEvaluacion({ teamId, previo, bloqueada }: { teamId: string; previo: Previo | null; bloqueada: boolean }) {
  const [conflicto, setConflicto] = useState<"no" | "si" | null>(previo ? "no" : null);
  const [niveles, setNiveles] = useState<Partial<Niveles>>(previo ?? {});
  const [errores, setErrores] = useState<Errores>({});
  const [guardado, setGuardado] = useState<number | null>(null);
  const [conflictoGuardado, setConflictoGuardado] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const completo = RUBRICA.every((c) => niveles[c.codigo.toLowerCase() as keyof Niveles]);
  const total = useMemo(() => (completo ? scoreTotal(niveles as Niveles) : null), [completo, niveles]);
  const min = previo?.tiempoUsadoSeg !== undefined ? Math.floor(previo.tiempoUsadoSeg / 60) : "";
  const seg = previo?.tiempoUsadoSeg !== undefined ? previo.tiempoUsadoSeg % 60 : "";

  if (conflictoGuardado) {
    return (
      <p role="status" className="rounded border-2 border-positive bg-surface p-4">
        Conflicto declarado. No evaluarás a este equipo y tu ausencia no afecta su promedio.{" "}
        <Link href="/jurado" className="underline">
          Volver a la lista
        </Link>
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      <ResumenErrores errores={errores} />

      {!previo && (
        <Grupo
          id="conflicto"
          leyenda="¿Tienes conflicto de interés con este equipo?"
          ayuda="Por ejemplo: son tus estudiantes, familiares o compañeros de trabajo."
        >
          <div className="grid grid-cols-2 gap-2">
            <Opcion name="conflicto" valor="no" etiqueta="No" checked={conflicto === "no"} onChange={() => setConflicto("no")} />
            <Opcion name="conflicto" valor="si" etiqueta="Sí, no evaluar" checked={conflicto === "si"} onChange={() => setConflicto("si")} />
          </div>
        </Grupo>
      )}

      {conflicto === "si" && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const motivo = String(new FormData(e.currentTarget).get("motivo") ?? "");
            iniciar(async () => {
              const r = await enviarConflicto(teamId, motivo);
              if (r.ok) setConflictoGuardado(true);
              else setErrores(r.errores);
            });
          }}
        >
          <CampoArea id="motivo" etiqueta="Motivo del conflicto" ayuda="Lo ve solo el comité." />
          <button type="submit" disabled={pendiente} className="justify-self-start rounded bg-accent px-5 py-3 font-medium text-on-accent disabled:opacity-60">
            Declarar conflicto
          </button>
        </form>
      )}

      {conflicto === "no" && (
        <form
          className="grid gap-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const minutos = Number(fd.get("minutos") || 0);
            const segundos = Number(fd.get("segundos") || 0);
            iniciar(async () => {
              const r = await enviarPuntaje(teamId, {
                ...niveles,
                tiempoUsadoSeg: minutos * 60 + segundos,
                demoEnVivo: fd.get("demo") === "vivo" ? true : fd.get("demo") === "respaldo" ? false : undefined,
                fortaleza: String(fd.get("fortaleza") ?? ""),
                recomendacion: String(fd.get("recomendacion") ?? ""),
              });
              if (r.ok) {
                setErrores({});
                setGuardado(r.total);
              } else {
                setGuardado(null);
                setErrores(r.errores);
              }
            });
          }}
        >
          {RUBRICA.map((c) => {
            const clave = c.codigo.toLowerCase() as keyof Niveles;
            return (
              <Grupo key={c.codigo} id={clave} leyenda={`${c.codigo} · ${c.nombre} (${c.peso} %)`} error={errores[clave]}>
                {([5, 4, 3, 2, 1] as const).map((n) => (
                  <Opcion
                    key={n}
                    name={clave}
                    valor={String(n)}
                    etiqueta={`Nivel ${n}`}
                    descripcion={c.descriptores[n]}
                    checked={niveles[clave] === n}
                    disabled={bloqueada}
                    onChange={() => setNiveles((v) => ({ ...v, [clave]: n }))}
                  />
                ))}
              </Grupo>
            );
          })}

          <fieldset className="grid gap-2">
            <legend className="mb-1 font-medium">Tiempo usado</legend>
            <div className="flex items-center gap-2">
              <label htmlFor="minutos" className="sr-only">
                Minutos
              </label>
              <input
                id="minutos"
                name="minutos"
                type="number"
                inputMode="numeric"
                min={0}
                max={30}
                defaultValue={min}
                disabled={bloqueada}
                className={`${claseInput} w-20`}
              />
              <span aria-hidden="true">min</span>
              <label htmlFor="segundos" className="sr-only">
                Segundos
              </label>
              <input
                id="segundos"
                name="segundos"
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                defaultValue={seg}
                disabled={bloqueada}
                className={`${claseInput} w-20`}
              />
              <span aria-hidden="true">s</span>
            </div>
            {errores.tiempoUsadoSeg && <p className="text-sm font-medium text-danger">{errores.tiempoUsadoSeg}</p>}
          </fieldset>

          <Grupo id="demoEnVivo" leyenda="Demo" error={errores.demoEnVivo}>
            <div className="grid grid-cols-2 gap-2">
              <Opcion name="demo" valor="vivo" etiqueta="En vivo" defaultChecked={previo?.demoEnVivo === true} disabled={bloqueada} />
              <Opcion name="demo" valor="respaldo" etiqueta="Respaldo autorizado" defaultChecked={previo?.demoEnVivo === false} disabled={bloqueada} />
            </div>
          </Grupo>

          <CampoArea
            id="fortaleza"
            etiqueta="Fortaleza"
            defaultValue={previo?.fortaleza}
            disabled={bloqueada}
            error={errores.fortaleza}
            ayuda="Se envía al equipo con su resultado."
          />
          <CampoArea
            id="recomendacion"
            etiqueta="Recomendación"
            defaultValue={previo?.recomendacion}
            disabled={bloqueada}
            error={errores.recomendacion}
            ayuda="Se envía al equipo con su resultado."
          />

          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t border-border bg-bg px-4 py-3">
            <p className="text-lg" aria-live="polite">
              Total: <strong className="tabular-nums">{total ?? "—"}</strong>/100
              {niveles.c2 === 1 && <span className="block text-sm text-danger">C2 = 1: el total no puede superar 60 (regla de no compensación).</span>}
            </p>
            {!bloqueada && (
              <button type="submit" disabled={pendiente} className="ml-auto rounded bg-accent px-5 py-3 font-medium text-on-accent disabled:opacity-60">
                {pendiente ? "Guardando…" : previo ? "Guardar corrección" : "Guardar evaluación"}
              </button>
            )}
          </div>
          {guardado !== null && (
            <p role="status" className="rounded border-2 border-positive bg-surface p-3 font-medium">
              Puntaje guardado: {guardado}/100. Puedes corregirlo hasta que se cierre la sala.{" "}
              <Link href="/jurado" className="underline">
                Volver a la lista
              </Link>
            </p>
          )}
        </form>
      )}
    </div>
  );
}
