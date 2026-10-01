import Link from "next/link";

export const metadata = { title: "Sin acceso" };

export default function SinAcceso() {
  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">No tienes acceso a esta sección</h1>
      <p className="mt-4 text-muted">
        Tu cuenta no tiene el rol necesario. Si crees que es un error, escribe a la mesa técnica en el canal
        #soporte-tecnico.
      </p>
      <Link href="/" className="mt-6 inline-block underline">Volver al inicio</Link>
    </section>
  );
}
