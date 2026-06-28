"use client";

import { CircleHelp, Droplets, Home, Milk } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/panales", label: "Pañal", icon: Droplets },
  { href: "/tomas", label: "Toma", icon: Milk },
  { href: "/dudas", label: "Duda", icon: CircleHelp }
] as const;

type Tab = (typeof tabs)[number];

function NavItem({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      aria-label={tab.label}
      href={tab.href}
      className={[
        "flex flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1 text-[10px] font-bold transition-colors",
        active ? "text-[var(--primary)]" : "text-[var(--ink-soft)]"
      ].join(" ")}
    >
      <Icon size={20} />
      <span>{tab.label}</span>
    </Link>
  );
}

/**
 * Barra inferior FLOTANTE (pill redondeada, despegada de los bordes, con blur):
 * 2 tabs + slot central (`center`, el mic) + 2 tabs. "Tu bebé" no está acá: se
 * entra desde el header (cap de 5 íconos para que quede armónico).
 */
export function TabBar({ center }: { center: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="pointer-events-none sticky bottom-0 z-20 flex justify-center px-4 pb-5 pt-2">
      <div
        className="pointer-events-auto flex w-full max-w-[360px] items-center justify-between gap-1 rounded-full border border-[var(--line)] bg-[rgba(33,29,46,0.92)] px-3 py-1.5 backdrop-blur-xl"
        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}
      >
        <NavItem tab={tabs[0]} active={isActive(tabs[0].href)} />
        <NavItem tab={tabs[1]} active={isActive(tabs[1].href)} />
        <div className="flex flex-1 justify-center">{center}</div>
        <NavItem tab={tabs[2]} active={isActive(tabs[2].href)} />
        <NavItem tab={tabs[3]} active={isActive(tabs[3].href)} />
      </div>
    </nav>
  );
}
