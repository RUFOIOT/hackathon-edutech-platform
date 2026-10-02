import { EVENT, POR_CONFIRMAR, mostrar } from "@/config/event";
import { CONSENTIMIENTOS, VERSION_CONSENTIMIENTOS } from "@/lib/content/consentimientos";
import { mesesRetencion } from "@/lib/privacidad/retencion";
import { enlacePlataforma } from "@/lib/sitio";

export const metadata = { title: "Privacidad", description: "Cómo tratamos tus datos personales en el Hackathon EduTech (LOPDP)." };

const enlace = "font-medium text-positive-text underline underline-offset-4";

/** Política de privacidad (LOPDP de Ecuador). Borrador pendiente de revisión legal (guía §12). */
export default function Privacidad() {
  const r = EVENT.responsableDatos;
  const correo = r.correo === POR_CONFIRMAR ? null : r.correo;
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Privacidad</h1>
      <p className="mt-3 max-w-prose text-muted">
        Cómo tratamos tus datos personales en el {EVENT.nombre}, conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador
        (LOPDP). Versión {VERSION_CONSENTIMIENTOS}.
      </p>
      <p role="note" className="mt-4 rounded border border-border bg-surface p-3 text-sm">
        Este texto está pendiente de revisión legal. Si cambia, publicaremos la nueva versión aquí y te pediremos aceptarla de nuevo cuando
        cambie una finalidad.
      </p>

      <div className="mt-8 grid gap-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6">
        <section aria-labelledby="responsable">
          <h2 id="responsable">Quién es responsable</h2>
          <p>
            {r.nombre}. Dirección: {mostrar(r.direccion)}. Contacto para temas de datos:{" "}
            {correo ? (
              <a href={`mailto:${correo}`} className={enlace}>
                {correo}
              </a>
            ) : (
              "por anunciar"
            )}
            .
          </p>
        </section>

        <section aria-labelledby="finalidades">
          <h2 id="finalidades">Para qué usamos tus datos</h2>
          <p>Cada autorización que das al inscribirte tiene una sola finalidad, y guardamos la versión exacta del texto que aceptaste:</p>
          <ul>
            {Object.values(CONSENTIMIENTOS).map((c) => (
              <li key={c.tipo}>
                <strong>{c.titulo}.</strong> {c.texto}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="datos">
          <h2 id="datos">Qué datos pedimos</h2>
          <ul>
            <li>Identificación y contacto: nombres, apellidos, correo y celular.</li>
            <li>Fecha de nacimiento, solo para calcular tu categoría (Junior u Open).</li>
            <li>Ciudad, institución, nivel, usuario de GitHub, perfil técnico, talla, restricciones alimentarias y necesidades de accesibilidad.</li>
            <li>
              Si eres Junior: nombre, cédula y contacto de tu representante legal y la autorización firmada. La cédula del representante es el
              único número de identidad que pedimos.
            </li>
            <li>Durante el evento: tu check-in, tu equipo, el repositorio y la entrega del proyecto.</li>
          </ul>
          <p>No usamos tus datos para publicidad ni los vendemos.</p>
        </section>

        <section aria-labelledby="quien">
          <h2 id="quien">Quién más los ve</h2>
          <ul>
            <li>El comité organizador y la mesa técnica, cada uno solo lo que necesita para su función.</li>
            <li>El jurado ve tu equipo y tu proyecto, no tus datos de contacto.</li>
            <li>
              Proveedores que procesan datos por encargo nuestro: Google Firebase (almacenamiento y acceso), Netlify (alojamiento de la web),
              Resend (envío de correos) y n8n (automatizaciones). Algunos de estos servicios guardan datos fuera del Ecuador, con las garantías
              contractuales que exige la LOPDP.
            </li>
            <li>GitHub, solo con tu usuario público, para validar el repositorio del equipo.</li>
          </ul>
        </section>

        <section aria-labelledby="menores">
          <h2 id="menores">Menores de edad</h2>
          <p>
            Quien tenga menos de 18 años participa con la autorización firmada de su representante legal. La autorización se guarda en un
            espacio privado; solo el comité la abre, con enlaces que caducan en minutos, para validarla.
          </p>
        </section>

        <section aria-labelledby="plazo">
          <h2 id="plazo">Cuánto tiempo los guardamos</h2>
          <p>
            Hasta {mesesRetencion()} meses después del evento. Luego los anonimizamos: borramos tu cuenta, contacto y autorización, y solo quedan
            estadísticas que no te identifican (categoría, nivel, ciudad, perfil técnico).
          </p>
        </section>

        <section aria-labelledby="derechos">
          <h2 id="derechos">Tus derechos</h2>
          <p>Puedes acceder a tus datos, corregirlos, pedir que los eliminemos, oponerte a un tratamiento y retirar una autorización.</p>
          <ul>
            <li>
              <strong>Acceso:</strong> descarga tus datos desde{" "}
              <a href={enlacePlataforma("/mi-equipo") ?? "#derechos"} className={enlace}>
                Mi equipo
              </a>{" "}
              → Mis datos.
            </li>
            <li>
              <strong>Eliminación:</strong> pídela desde Mi equipo → Mis datos. Respondemos en máximo 15 días. Si lo pides antes del evento,
              también sales de tu equipo.
            </li>
            <li>
              <strong>Corrección u otros derechos:</strong> escribe a la mesa técnica{correo ? ` o a ${correo}` : ""}.
            </li>
          </ul>
          <p>Si no quedas conforme con nuestra respuesta, puedes acudir a la Superintendencia de Protección de Datos Personales.</p>
        </section>

        <section aria-labelledby="seguridad">
          <h2 id="seguridad">Cómo los protegemos</h2>
          <p>
            Acceso con enlace de un solo uso, conexiones cifradas, permisos por rol, registro de auditoría de cada cambio sensible y registros
            técnicos sin correos, teléfonos ni contraseñas.
          </p>
        </section>
      </div>
    </article>
  );
}
