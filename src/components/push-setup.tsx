"use client";

import { Bell, BellRing } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Activa las notificaciones push en ESTE dispositivo.
 *
 * Flujo del usuario (botón → permiso → suscripción):
 *   1. Registramos el service worker (/sw.js).
 *   2. Pedimos permiso de notificaciones (tiene que salir de un gesto del usuario,
 *      por eso va en un onClick, no en el useEffect).
 *   3. Nos suscribimos al push con la clave pública VAPID.
 *   4. Mandamos la suscripción al backend para guardarla.
 *
 * En iPhone esto SOLO funciona si la app está instalada en la pantalla de inicio.
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

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "enabled" : "ready"))
      .catch(() => setState("ready"));
  }, []);

  async function enable() {
    try {
      setErrorMsg("");

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Falta la clave pública VAPID (env).");

      // 1. Service worker.
      const reg = await navigator.serviceWorker.register("/sw.js");

      // 2. Permiso (gesto del usuario).
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "ready");
        return;
      }

      // 3. Suscripción al push.
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // cast a BufferSource: el tipo genérico de Uint8Array no encaja directo
        // con la firma de applicationServerKey en algunas versiones de lib.dom.
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
      });

      // 4. Guardar en el backend.
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON())
      });
      if (!res.ok) throw new Error("No pude guardar la suscripción en el servidor.");

      setState("enabled");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Error activando avisos.");
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
              <p className="text-sm font-bold">Activar avisos en este dispositivo</p>
              <p className="text-xs text-[var(--ink-soft)]">
                Te avisamos cuando sea hora de la próxima toma.
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
