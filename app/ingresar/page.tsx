import type { Metadata } from "next";
import { FormIngreso } from "./form-ingreso";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Ingresar({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const { siguiente } = await searchParams;
  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">Ingresar</h1>
      <p className="mt-2 text-muted">
        Te enviamos un enlace a tu correo. Ábrelo en este mismo dispositivo para entrar; no necesitas contraseña.
      </p>
      <FormIngreso siguiente={siguiente ?? null} />
    </section>
  );
}
