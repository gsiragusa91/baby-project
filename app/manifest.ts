import type { MetadataRoute } from "next";

/**
 * Web App Manifest. Es lo que le dice al navegador "esto se puede INSTALAR
 * como app" (ícono, nombre, color, pantalla completa). Next.js lo sirve
 * automáticamente en /manifest.webmanifest a partir de este archivo.
 *
 * En iPhone, instalar la PWA (Compartir → Agregar a inicio, desde Safari) es
 * además el REQUISITO para que funcionen las Web Push.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baby's Project",
    short_name: "Baby",
    description: "Registro y recordatorios para padres primerizos",
    start_url: "/",
    display: "standalone", // sin barra de navegador: se ve como app nativa
    background_color: "#14121c",
    theme_color: "#14121c",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
