"use client";

import { Bell, BellRing } from "lucide-react";
import { useEffect, useState } from "react";

import { getMicStream } from "@/src/lib/mic";

/**
 * Activa, en un solo gesto, los permisos del dispositivo: notificaciones (push)
 * Y micrófono (registro por voz).
 *
 * Flujo del botón "Activar":
 *   1. Pedimos el micrófono primero (getUserMedia) — así no perdemos el "user
 *      gesture" después de los awaits siguientes, que en iOS lo invalidan.
 *   2. Registramos el service worker y pedimos permiso de notificaciones.
 *   3. Si lo permite, nos suscribimos al push y guardamos la suscripción.
 *
 * Guardamos un flag en localStorage ("perms-activated") porque el estado del
 * permiso de mic no es consultable de forma confiable en iOS; así sabemos si ya
 * pasó por el flujo y no mostramos la tarjeta de más.
 *
 * En iPhone esto SOLO funciona con la app instalada en la pantalla de inicio.
 */

type UIState = "loading" | "unsupported" | "ready" | "enabled" | "denied" | "error";

// La clave VAPID viene en base64url; el navegador la necesita como Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushSetup() {
  const [state, setState] = useState<UIState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Al montar: vemos si el navegador soporta push y si ya estamos suscriptos.
  // Arrancamos siempre en "loading" (coincide con el render del servidor, que
  // no tiene window) y recién acá, en el cliente, decidimos el estado real.
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!supported || Notification.permission === "denied") {
      // Un único setState síncrono y final (no encadena renders); el resto es async.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(!supported ? "unsupported" : "denied");
      return;
    }

    // Registramos el SW acá (no solo en el botón). Si usáramos
    // navigator.serviceWorker.ready, se quedaría esperando para siempre a un SW
    // que todavía no existe → el botón nunca aparecería (deadlock).
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        // "enabled" (tarjeta oculta) solo si ya hay push Y ya pasó por el flujo
        // de permisos (que incluye el mic). Si no, mostramos "Activar".
        const activated = localStorage.getItem("perms-activated") === "1";
        setState(sub && activated ? "enabled" : "ready");
      })
      .catch(() => setState("ready"));
  }, []);

  async function enable() {
    try {
      setErrorMsg("");

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Falta la clave pública VAPID (env).");

      // 1. Micrófono PRIMERO: getUserMedia exige user-gesture y los awaits que
      //    siguen (registro SW, requestPermission) lo invalidan en iOS. Si el
      //    usuario lo deniega no es fatal para los avisos.
      try {
        await getMicStream();
      } catch {
        // mic denegado/no disponible — seguimos con los avisos igual.
      }

      // 2. Service worker + permiso de notificaciones.
      const reg = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();

      // 3. Si permitió notificaciones, suscribimos al push y lo guardamos.
      if (permission === "granted") {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // cast a BufferSource: el tipo genérico de Uint8Array no encaja directo
          // con la firma de applicationServerKey en algunas versiones de lib.dom.
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
        });
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON())
        });
        if (!res.ok) throw new Error("No pude guardar la suscripción en el servidor.");
      }

      // Pasó por el flujo de permisos (haya o no aceptado notis).
      localStorage.setItem("perms-activated", "1");
      setState(permission === "denied" ? "denied" : "enabled");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Error activando permisos.");
      setState("error");
    }
  }

  if (state === "loading" || state === "enabled") return null;

  // Mensaje según el estado.
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-[var(--primary)]">
          {state === "denied" ? <BellRing size={20} /> : <Bell size={20} />}
        </span>
        <div className="flex-1">
          {state === "unsupported" && (
            <p className="text-sm font-semibold text-[var(--ink-soft)]">
              Este navegador no soporta avisos. En iPhone, agregá la app a la
              pantalla de inicio desde Safari.
            </p>
          )}
          {state === "denied" && (
            <p className="text-sm font-semibold text-[var(--ink-soft)]">
              Los avisos están bloqueados. Activalos en los ajustes del sitio.
            </p>
          )}
          {(state === "ready" || state === "error") && (
            <>
              <p className="text-sm font-bold">Activar avisos y micrófono</p>
              <p className="text-xs text-[var(--ink-soft)]">
                Permití notificaciones (recordatorios) y micrófono (registro por voz). Se piden una sola vez.
              </p>
              {state === "error" && (
                <p className="mt-1 text-xs font-semibold text-[var(--danger)]">{errorMsg}</p>
              )}
            </>
          )}
        </div>
        {(state === "ready" || state === "error") && (
          <button
            type="button"
            onClick={enable}
            className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-bold text-[var(--primary-ink)]"
          >
            Activar
          </button>
        )}
      </div>
    </div>
  );
}
