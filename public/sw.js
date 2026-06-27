/* Service worker de Baby's Project.
 *
 * Un service worker es un script que el navegador mantiene vivo EN SEGUNDO PLANO,
 * separado de la pestaña, incluso con la app cerrada. Por eso es lo único capaz
 * de recibir un "push" del servidor y mostrar una notificación cuando no estás
 * mirando la app.
 *
 * Acá manejamos 2 eventos:
 *  - "push": llegó un mensaje del servidor → mostramos la notificación.
 *  - "notificationclick": el usuario tocó la notificación → abrimos la app.
 */

self.addEventListener("push", (event) => {
  // El servidor manda un JSON. Si por algún motivo no viene, usamos defaults.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Baby's Project";
  const options = {
    body: payload.body || "Tenés un recordatorio.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // vibración suave (donde el dispositivo lo soporte)
    vibrate: [200, 100, 200],
    // tag: si llegan varios, se agrupan en vez de apilarse infinito
    tag: payload.tag || "reminder",
    data: { url: payload.url || "/" }
  };

  // waitUntil mantiene vivo al service worker hasta que la notificación se
  // muestra; si no, el navegador podría matarlo antes de terminar.
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Si la app ya está abierta en alguna ventana, la enfocamos.
      for (const win of wins) {
        if ("focus" in win) return win.focus();
      }
      // Si no, abrimos una nueva.
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
