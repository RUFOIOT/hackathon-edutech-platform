import type { Metadata } from "next";
import { PaginaGuia } from "@/components/pagina-guia";
import { cargarGuia } from "@/lib/content/markdown";

export const metadata: Metadata = {
  title: "Guía del hacker",
  description: "Cómo llegar, armar el repositorio, cumplir los checkpoints y entregar.",
};

export default async function GuiaHacker() {
  return <PaginaGuia doc={await cargarGuia("guia-hacker")} />;
}
