"use client";

/**
 * Manejo del stream del micrófono, REUSANDO el permiso.
 *
 * El problema que resuelve: antes pedíamos getUserMedia en cada grabación y
 * soltábamos el stream al terminar. Si el navegador no recordaba el permiso,
 * eso disparaba el cartel en cada grabación. Acá pedimos el stream UNA vez por
 * sesión y lo reusamos; entre grabaciones lo dejamos "muteado" (tracks
 * disabled) para no mantener el micrófono capturando.
 *
 * Nota honesta: que el permiso persista ENTRE aperturas de la app depende del
 * navegador/SO (en iOS, la PWA instalada lo recuerda mejor que Safari). El
 * código solo evita re-pedirlo dentro de una misma sesión.
 */

let stream: MediaStream | null = null;

function hasLiveTrack(s: MediaStream | null) {
  return Boolean(s && s.getAudioTracks().some((t) => t.readyState === "live"));
}

/** Devuelve el stream del mic; lo crea (pide permiso) solo si no existe o murió. */
export async function getMicStream(): Promise<MediaStream> {
  if (hasLiveTrack(stream)) return stream as MediaStream;
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // Arranca muteado: conservamos permiso/stream sin capturar hasta grabar.
  stream.getAudioTracks().forEach((t) => (t.enabled = false));
  return stream;
}

/** Activa/desactiva la captura sin soltar el stream (no re-pide permiso). */
export function setMicCapturing(on: boolean) {
  stream?.getAudioTracks().forEach((t) => (t.enabled = on));
}
