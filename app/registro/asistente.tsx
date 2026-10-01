"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLES_EQUIPO, TRACKS, TRACK_CODES } from "@/config/event";
import { CONSENTIMIENTOS } from "@/lib/content/consentimientos";
import { AREAS, DESCRIPCION_ROL, NIVELES, NIVELES_ACADEMICOS, NOMBRE_AREA, NOMBRE_ROL, TALLAS, TECNOLOGIAS } from "@/lib/content/perfil";
import { calcularCategoria } from "@/lib/models/categoria";
import type { Borrador } from "@/lib/registro/servicio";
import { CampoArea, CampoSelect, CampoTexto, Grupo, Opcion, ResumenErrores, claseInput } from "@/components/formulario";
import { confirmar, guardarPaso, irAPaso } from "./acciones";

type Errores = Record<string, string>;

const boton = "rounded bg-accent px-5 py-3 font-medium text-on-accent hover:brightness-95 disabled:opacity-60";
const botonSecundario = "rounded border border-border px-5 py-3 font-medium";

function pasosDe(modo: Borrador["modo"]) {
  return [
    { n: 1, nombre: "Modalidad" },
    { n: 2, nombre: "Datos personales" },
    { n: 3, nombre: "Perfil técnico" },
    ...(modo === "equipo" ? [{ n: 4, nombre: "Equipo y track" }] : []),
    { n: 5, nombre: "Consentimientos" },
  ];
}

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const CAMPOS_PASO2 = [
  "nombres",
  "apellidos",
  "celular",
  "fechaNacimiento",
  "ciudad",
  "institucion",
  "nivel",
  "githubUsername",
  "talla",
  "restriccionesAlimentarias",
  "accesibilidad",
];

export function Asistente({
  inicial,
  email,
  codigoSugerido,
}: {
  inicial: Borrador;
  email: string;
  codigoSugerido: { codigo: string; equipo: string | null } | null;
}) {
  const router = useRouter();
  const [borrador, setBorrador] = useState<Borrador>(inicial);
  const [errores, setErrores] = useState<Errores>({});
  const [pendiente, iniciar] = useTransition();
  const titulo = useRef<HTMLHeadingElement>(null);
  const primerRender = useRef(true);

  // Al cambiar de paso, el foco va al título del paso (lectores de pantalla y teclado).
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    titulo.current?.focus();
  }, [borrador.paso]);

  const pasos = pasosDe(borrador.modo);
  const indice = Math.max(0, pasos.findIndex((p) => p.n === borrador.paso));
  const actual = pasos[indice]!;

  function enviar(paso: 1 | 2 | 3 | 4, datos: unknown) {
    iniciar(async () => {
      const r = await guardarPaso(paso, datos);
      if (r.ok) {
        setErrores({});
        setBorrador(r.borrador);
      } else setErrores(r.errores);
    });
  }

  function atras() {
    const anterior = pasos[indice - 1];
    if (!anterior) return;
    setErrores({});
    setBorrador((b) => ({ ...b, paso: anterior.n }));
    void irAPaso(anterior.n);
  }

  const navegacion = (etiqueta = "Guardar y continuar") => (
    <div className="mt-8 flex flex-wrap gap-3">
      {indice > 0 && (
        <button type="button" onClick={atras} className={botonSecundario} disabled={pendiente}>
          Volver
        </button>
      )}
      <button type="submit" className={boton} disabled={pendiente}>
        {pendiente ? "Guardando…" : etiqueta}
      </button>
    </div>
  );

  return (
    <div>
      <ol aria-label="Pasos de la inscripción" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {pasos.map((p, i) => (
          <li key={p.n} aria-current={p.n === actual.n ? "step" : undefined} className={p.n === actual.n ? "font-semibold" : "text-muted"}>
            {i + 1}. {p.nombre}
          </li>
        ))}
      </ol>
      <h2 ref={titulo} tabIndex={-1} className="mt-6 text-2xl font-semibold outline-none">
        Paso {indice + 1} de {pasos.length}: {actual.nombre}
      </h2>
      <p className="mt-1 text-sm text-muted">Tu avance se guarda en cada paso: puedes cerrar la página y continuar luego.</p>
      <div className="mt-6">
        <ResumenErrores errores={errores} />
      </div>

      {actual.n === 1 && (
        <form
          key="p1"
          className="mt-6 grid gap-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            enviar(1, { modo: fd.get("modo") ?? undefined, codigo: texto(fd, "codigo") || undefined });
          }}
        >
          <Paso1 borrador={borrador} errores={errores} codigoSugerido={codigoSugerido} />
          {navegacion()}
        </form>
      )}

      {actual.n === 2 && (
        <form
          key="p2"
          className="mt-6 grid gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            enviar(2, Object.fromEntries(CAMPOS_PASO2.map((k) => [k, texto(fd, k)])));
          }}
        >
          <Paso2 borrador={borrador} errores={errores} email={email} />
          {navegacion()}
        </form>
      )}

      {actual.n === 3 && (
        <form
          key="p3"
          className="mt-6 grid gap-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            enviar(3, {
              rolPreferido: fd.get("rolPreferido") ?? undefined,
              niveles: Object.fromEntries(AREAS.map((a) => [a, fd.get(`nivel-${a}`) ?? undefined])),
              tecnologias: fd.getAll("tecnologias").map(String),
              otraTecnologia: texto(fd, "otraTecnologia"),
              hackathonsPrevios: texto(fd, "hackathonsPrevios"),
            });
          }}
        >
          <Paso3 borrador={borrador} errores={errores} />
          {navegacion()}
        </form>
      )}

      {actual.n === 4 && (
        <form
          key="p4"
          className="mt-6 grid gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            enviar(4, {
              nombreEquipo: texto(fd, "nombreEquipo"),
              track: fd.get("track") ?? undefined,
              problemaCandidato: texto(fd, "problemaCandidato"),
              correosIntegrantes: fd
                .getAll("correosIntegrantes")
                .map((s) => String(s).trim())
                .filter(Boolean),
            });
          }}
        >
          <Paso4 borrador={borrador} errores={errores} />
          {navegacion()}
        </form>
      )}

      {actual.n === 5 && (
        <form
          key="p5"
          className="mt-6 grid gap-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            iniciar(async () => {
              const r = await confirmar(fd);
              if (r.ok) router.push("/mi-equipo?inscrito=1");
              else setErrores(r.errores);
            });
          }}
        >
          <Paso5 borrador={borrador} errores={errores} />
          {navegacion(borrador.modo === "equipo" ? "Inscribir a mi equipo" : "Confirmar mi inscripción")}
        </form>
      )}
    </div>
  );
}

function Paso1({
  borrador,
  errores,
  codigoSugerido,
}: {
  borrador: Borrador;
  errores: Errores;
  codigoSugerido: { codigo: string; equipo: string | null } | null;
}) {
  const [modo, setModo] = useState(borrador.modo ?? (codigoSugerido ? "unirse" : undefined));
  return (
    <>
      <Grupo id="modo" leyenda="¿Cómo quieres inscribirte?" error={errores.modo}>
        <Opcion
          name="modo"
          valor="equipo"
          etiqueta="Inscribir a mi equipo"
          descripcion="Creas el equipo, eliges el track e invitas a 1 a 4 personas por correo."
          checked={modo === "equipo"}
          onChange={() => setModo("equipo")}
        />
        <Opcion
          name="modo"
          valor="individual"
          etiqueta="Inscribirme y buscar equipo"
          descripcion="La organización te asigna un equipo el viernes en el matchmaking."
          checked={modo === "individual"}
          onChange={() => setModo("individual")}
        />
        <Opcion
          name="modo"
          valor="unirse"
          etiqueta="Unirme a un equipo con código"
          descripcion="Tu capitán te compartió un código de invitación de 6 caracteres."
          checked={modo === "unirse"}
          onChange={() => setModo("unirse")}
        />
      </Grupo>
      {modo === "unirse" && (
        <CampoTexto
          id="codigo"
          etiqueta="Código de invitación"
          ayuda={codigoSugerido?.equipo ? `Tienes una invitación del equipo ${codigoSugerido.equipo}.` : "Lo encuentras en el correo de invitación."}
          defaultValue={borrador.codigo ?? codigoSugerido?.codigo ?? ""}
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={6}
          className={`${claseInput} font-mono uppercase tracking-widest`}
          error={errores.codigo}
        />
      )}
    </>
  );
}

function Paso2({ borrador, errores, email }: { borrador: Borrador; errores: Errores; email: string }) {
  const p = borrador.personales;
  const [nacimiento, setNacimiento] = useState(p?.fechaNacimiento ?? "");
  const cat = /^\d{4}-\d{2}-\d{2}$/.test(nacimiento) ? calcularCategoria(nacimiento) : null;
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoTexto id="nombres" etiqueta="Nombres" autoComplete="given-name" defaultValue={p?.nombres} error={errores.nombres} />
        <CampoTexto id="apellidos" etiqueta="Apellidos" autoComplete="family-name" defaultValue={p?.apellidos} error={errores.apellidos} />
      </div>
      <CampoTexto id="correo" etiqueta="Correo" value={email} readOnly ayuda="Verificado con tu enlace de ingreso." className={`${claseInput} text-muted`} />
      <CampoTexto
        id="celular"
        etiqueta="Celular"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="09XXXXXXXX"
        defaultValue={p?.celular}
        error={errores.celular}
      />
      <div className="grid gap-1.5">
        <CampoTexto
          id="fechaNacimiento"
          etiqueta="Fecha de nacimiento"
          type="date"
          autoComplete="bday"
          value={nacimiento}
          onChange={(e) => setNacimiento(e.target.value)}
          error={errores.fechaNacimiento}
          ayuda="Con ella calculamos tu categoría al día del evento."
        />
        {cat && (
          <p role="status" className={`text-sm ${cat.ok ? "text-positive-text" : "font-medium text-danger"}`}>
            {cat.ok
              ? cat.categoria === "JUNIOR"
                ? `Categoría Junior (${cat.edad} años): en el último paso necesitarás la autorización firmada de tu representante.`
                : `Categoría Open (${cat.edad} años).`
              : cat.motivo}
          </p>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoTexto id="ciudad" etiqueta="Ciudad" autoComplete="address-level2" defaultValue={p?.ciudad} error={errores.ciudad} />
        <CampoTexto
          id="institucion"
          etiqueta="Institución u organización"
          autoComplete="organization"
          defaultValue={p?.institucion}
          error={errores.institucion}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoSelect id="nivel" etiqueta="Nivel" opciones={NIVELES_ACADEMICOS} defaultValue={p?.nivel} error={errores.nivel} />
        <CampoSelect
          id="talla"
          etiqueta="Talla de camiseta"
          opciones={TALLAS.map((t) => ({ valor: t, etiqueta: t }))}
          defaultValue={p?.talla}
          error={errores.talla}
        />
      </div>
      <CampoTexto
        id="githubUsername"
        etiqueta="Usuario de GitHub"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={p?.githubUsername}
        error={errores.githubUsername}
        ayuda="Comprobamos que exista. Lo usarás para entrar a la organización del evento."
      />
      <CampoTexto
        id="restriccionesAlimentarias"
        etiqueta="Restricciones alimentarias"
        opcional
        defaultValue={p?.restriccionesAlimentarias}
        error={errores.restriccionesAlimentarias}
      />
      <CampoArea
        id="accesibilidad"
        etiqueta="Necesidades de accesibilidad"
        opcional
        defaultValue={p?.accesibilidad}
        error={errores.accesibilidad}
        ayuda="Cuéntanos qué necesitas para participar en igualdad de condiciones."
      />
    </>
  );
}

function Paso3({ borrador, errores }: { borrador: Borrador; errores: Errores }) {
  const p = borrador.perfil;
  return (
    <>
      <Grupo id="rolPreferido" leyenda="Rol que prefieres en el equipo" error={errores.rolPreferido}>
        {ROLES_EQUIPO.map((r) => (
          <Opcion key={r} name="rolPreferido" valor={r} etiqueta={NOMBRE_ROL[r]} descripcion={DESCRIPCION_ROL[r]} defaultChecked={p?.rolPreferido === r} />
        ))}
      </Grupo>
      {AREAS.map((a) => (
        <Grupo key={a} id={`niveles-${a}`} leyenda={`Tu nivel en ${NOMBRE_AREA[a]}`} error={errores[`niveles.${a}`]}>
          <div className="grid gap-2 sm:grid-cols-2">
            {NIVELES[a].map((desc, i) => (
              <Opcion key={i} name={`nivel-${a}`} valor={String(i + 1)} etiqueta={`Nivel ${i + 1}`} descripcion={desc} defaultChecked={p?.niveles[a] === i + 1} />
            ))}
          </div>
        </Grupo>
      ))}
      <Grupo id="tecnologias" leyenda="Tecnologías que dominas" ayuda="Marca todas las que apliquen." error={errores.tecnologias}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TECNOLOGIAS.map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input type="checkbox" name="tecnologias" value={t} defaultChecked={p?.tecnologias.includes(t)} className="accent-navy-700" />
              {t}
            </label>
          ))}
        </div>
      </Grupo>
      <CampoTexto id="otraTecnologia" etiqueta="Otra tecnología" opcional defaultValue={p?.otraTecnologia} />
      <CampoTexto
        id="hackathonsPrevios"
        etiqueta="¿En cuántos hackathons has participado?"
        type="number"
        min={0}
        max={50}
        inputMode="numeric"
        defaultValue={p?.hackathonsPrevios ?? 0}
        error={errores.hackathonsPrevios}
      />
    </>
  );
}

function Paso4({ borrador, errores }: { borrador: Borrador; errores: Errores }) {
  const e = borrador.equipo;
  const [problema, setProblema] = useState(e?.problemaCandidato ?? "");
  const correos = [...(e?.correosIntegrantes ?? []), "", "", "", ""].slice(0, 4);
  return (
    <>
      <CampoTexto
        id="nombreEquipo"
        etiqueta="Nombre del equipo"
        defaultValue={e?.nombreEquipo}
        error={errores.nombreEquipo}
        ayuda="Debe ser único. Con él se arma el nombre del repositorio."
        maxLength={40}
      />
      <Grupo id="track" leyenda="Track" error={errores.track}>
        {TRACK_CODES.map((t) => (
          <Opcion key={t} name="track" valor={t} etiqueta={`${t} · ${TRACKS[t].nombre}`} descripcion={TRACKS[t].pregunta} defaultChecked={e?.track === t} />
        ))}
      </Grupo>
      <CampoArea
        id="problemaCandidato"
        etiqueta="Problema candidato"
        value={problema}
        onChange={(ev) => setProblema(ev.target.value)}
        maxLength={280}
        error={errores.problemaCandidato}
        ayuda={`Cuéntalo en una o dos frases. ${problema.length}/280 caracteres.`}
      />
      <Grupo
        id="correosIntegrantes"
        leyenda="Correos de los demás integrantes"
        ayuda="De 1 a 4 personas. Les enviamos una invitación con el código del equipo."
        error={errores.correosIntegrantes}
      >
        {correos.map((c, i) => (
          <div key={i} className="grid gap-1">
            <label htmlFor={`correo-${i}`} className="text-sm">
              Integrante {i + 2}
              {i > 0 && <span className="text-muted"> (opcional)</span>}
            </label>
            <input id={`correo-${i}`} name="correosIntegrantes" type="email" autoComplete="off" defaultValue={c} className={claseInput} />
          </div>
        ))}
      </Grupo>
    </>
  );
}

const CAMPO_CONSENTIMIENTO = { reglas: "aceptaReglas", datos_personales: "aceptaDatos", uso_imagen: "aceptaImagen" } as const;

function Paso5({ borrador, errores }: { borrador: Borrador; errores: Errores }) {
  const cat = borrador.personales ? calcularCategoria(borrador.personales.fechaNacimiento) : null;
  const junior = cat?.ok && cat.categoria === "JUNIOR";
  return (
    <>
      {borrador.modo === "unirse" && borrador.equipoUnirse && (
        <p className="rounded border border-border bg-surface p-3">
          Te unirás al equipo <strong>{borrador.equipoUnirse.nombre}</strong> ({borrador.equipoUnirse.track}).
        </p>
      )}
      {(["reglas", "datos_personales", "uso_imagen"] as const).map((tipo) => {
        const c = CONSENTIMIENTOS[tipo];
        const name = CAMPO_CONSENTIMIENTO[tipo];
        return (
          <div key={tipo} className="rounded border border-border bg-surface p-4">
            <h3 className="font-semibold">{c.titulo}</h3>
            <p id={`${name}-texto`} className="mt-2 text-sm">
              {c.texto}
            </p>
            <label className="mt-3 flex items-start gap-2 font-medium">
              <input
                id={name}
                type="checkbox"
                name={name}
                aria-describedby={`${name}-texto`}
                aria-invalid={errores[name] ? true : undefined}
                className="mt-1 accent-navy-700"
              />
              {c.obligatorio ? `Acepto: ${c.titulo.toLowerCase()}` : "Acepto el uso de mi imagen (opcional)"}
            </label>
            {errores[name] && <p className="mt-1 text-sm font-medium text-danger">{errores[name]}</p>}
          </div>
        );
      })}

      {junior && (
        <section aria-labelledby="junior-titulo" className="grid gap-5 rounded border-2 border-accent bg-surface p-4">
          <div>
            <h3 id="junior-titulo" className="text-lg font-semibold">
              Autorización del representante legal
            </h3>
            <p className="mt-1 text-sm">
              Como participas en la categoría Junior, tu representante debe firmar la autorización.{" "}
              <a href="/plantilla-autorizacion.pdf" download className="font-medium text-positive-text underline">
                Descargar la plantilla (PDF)
              </a>
              . Imprímela, fírmala, escanéala y súbela aquí.
            </p>
            <p className="mt-2 text-sm text-muted">{CONSENTIMIENTOS.autorizacion_menor.texto}</p>
          </div>
          <CampoTexto id="rep_nombres" etiqueta="Nombre completo del representante" autoComplete="off" error={errores.rep_nombres} />
          <div className="grid gap-5 sm:grid-cols-2">
            <CampoTexto
              id="rep_cedula"
              etiqueta="Cédula del representante"
              inputMode="numeric"
              maxLength={10}
              autoComplete="off"
              error={errores.rep_cedula}
              ayuda="Solo se usa para verificar la autorización."
            />
            <CampoTexto id="rep_parentesco" etiqueta="Parentesco" placeholder="Madre, padre, tutor legal…" error={errores.rep_parentesco} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <CampoTexto id="rep_correo" etiqueta="Correo del representante" type="email" autoComplete="off" error={errores.rep_correo} />
            <CampoTexto id="rep_celular" etiqueta="Celular del representante" type="tel" inputMode="tel" autoComplete="off" error={errores.rep_celular} />
          </div>
          <CampoTexto id="archivo" etiqueta="Autorización firmada (PDF, máximo 4 MB)" type="file" accept="application/pdf,.pdf" error={errores.archivo} />
        </section>
      )}
    </>
  );
}
