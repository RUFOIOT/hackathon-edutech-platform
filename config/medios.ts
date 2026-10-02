/**
 * Medios de la portada (fotos y videos cortos). Los archivos van en public/media/ y se declaran
 * aquí; mientras la lista esté vacía, la sección de galería no se muestra.
 *
 * Solo material con autorización de uso de imagen (y del representante, si aparecen menores).
 * Videos: MP4 H.264, sin audio, menos de 4 MB y menos de 15 s, con un póster JPG.
 */
export interface Medio {
  tipo: "imagen" | "video";
  src: string;
  alt: string;
}

export const MEDIOS: { videoHero: { src: string; poster: string } | null; galeria: Medio[] } = {
  videoHero: null,
  galeria: [],
};
