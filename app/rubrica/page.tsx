import type { Metadata } from "next";
import { PaginaGuia } from "@/components/pagina-guia";
import { cargarGuia } from "@/lib/content/markdown";

export const metadata: Metadata = { title: "Rúbrica de evaluación", description: "Admisibilidad, criterios, pesos, descriptores y desempates." };

export default async function Rubrica() {
  return <PaginaGuia doc={await cargarGuia("rubrica")} />;
}
