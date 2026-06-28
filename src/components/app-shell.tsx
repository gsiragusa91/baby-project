"use client";

import { Baby, LogOut, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/actions";

import { TabBar } from "./tab-bar";
import { VoiceDock } from "./voice-dock";

/** Eyebrow (label chico arriba del nombre) según la sección activa. */
const EYEBROW: Record<string, string> = {
  "/": "Hoy",
  "/panales": "Pañales",
  "/tomas": "Tomas",
  "/dudas": "Dudas",
  "/bebe": "Tu bebé"
};

function eyebrowFor(pathname: string) {
  if (pathname === "/") return EYEBROW["/"];
  const key = Object.keys(EYEBROW).find((k) => k !== "/" && pathname.startsWith(k));
  return key ? EYEBROW[key] : "";
}

/**
 * Chrome global de la app: header (con safe-area vía .mobile-shell), el
 * contenido de la tab activa (children), el botón de voz flotante y la tab bar.
 * Persiste entre tabs porque vive en el layout del route group (app).
 */
export function AppShell({
  babyName,
  email,
  voiceParser = "api",
  children
}: {
  babyName: string;
  email: string;
  voiceParser?: "api" | "mock";
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="mobile-shell flex min-h-svh flex-col">
      <header className="px-5 pb-3 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
              {eyebrowFor(pathname)}
            </p>
            {/* El nombre del bebé es el acceso a "Tu bebé" (sacamos esa tab de la
                barra para no pasar de 5 íconos). */}
            <Link href="/bebe" className="mt-1 flex items-center gap-2">
              <h1 className="flex items-center gap-2 text-3xl font-bold">
                <Baby size={28} />
                {babyName}
              </h1>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              aria-label="Invitar"
              className="tap-target flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] p-3"
              href="/family"
            >
              <UserPlus size={20} />
            </Link>
            <form action={signOutAction}>
              <button
                aria-label="Salir"
                className="tap-target rounded-full border border-[var(--line)] bg-[var(--surface)] p-3"
                type="submit"
              >
                <LogOut size={20} />
              </button>
            </form>
          </div>
        </div>
        <p className="mt-2 truncate text-sm text-[var(--ink-soft)]">{email}</p>
      </header>

      <main className="flex-1">{children}</main>

      {/* Barra inferior flotante: 4 tabs + el mic de voz al centro. */}
      <TabBar center={<VoiceDock parser={voiceParser} />} />
    </div>
  );
}
