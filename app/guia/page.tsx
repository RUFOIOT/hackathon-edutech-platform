import type { Metadata } from "next";
import { PaginaGuia } from "@/components/pagina-guia";
import { cargarGuia } from "@/lib/content/markdown";

export const metadata: Metadata = { title: "Guía oficial", description: "Tracks, categorías, agenda, reglas y premios del hackathon." };

export default async function Guia() {
  return <PaginaGuia doc={await cargarGuia("guia")} />;
}
