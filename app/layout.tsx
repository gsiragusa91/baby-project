import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Baby's Project",
  description: "Registro mobile-first para padres primerizos",
  // iOS usa esto cuando la app está instalada en la pantalla de inicio.
  appleWebApp: {
    capable: true,
    title: "Baby",
    statusBarStyle: "black-translucent"
  },
  icons: {
    apple: "/icons/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#14121c"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
