/**
 * Canal Alexa vía Voice Monkey.
 *
 * Voice Monkey es un puente: vinculás tu Echo a su skill y, con un request HTTP,
 * hacés que Alexa "anuncie" un texto por voz en ese dispositivo. No es una alarma
 * nativa de Alexa (eso no tiene API pública), es un anuncio hablado en el momento.
 *
 * API v3: POST https://api-v3.voicemonkey.io/announce con JSON { token, device, speech }.
 * (Opcionales: voice, language, chime, audio… para sumar sonido/canción después.)
 * Docs: https://voicemonkey.io/docs/api/announcement.html
 */

export type VoiceMonkeyResult = { ok: boolean; error?: string };

/**
 * Hace que Alexa anuncie `text` en el device configurado.
 * Best-effort: si no está configurado o falla, devuelve ok:false SIN tirar,
 * para no romper el resto del dispatch (el push no debe depender de esto).
 */
export async function announceOnAlexa(text: string): Promise<VoiceMonkeyResult> {
  const token = process.env.VOICEMONKEY_TOKEN;
  const device = process.env.VOICEMONKEY_DEVICE;

  // Si no está configurado, lo tratamos como "canal apagado", no como error.
  if (!token || !device) {
    return { ok: false, error: "voicemonkey-not-configured" };
  }

  try {
    const res = await fetch("https://api-v3.voicemonkey.io/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, device, speech: text })
    });
    if (!res.ok) {
      return { ok: false, error: `voicemonkey-http-${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "voicemonkey-fetch-failed"
    };
  }
}

/**
 * Dispara una RUTINA de Alexa (vía un "routine trigger" device de Voice Monkey).
 * Sirve para algo más llamativo que la voz: poner una canción de Spotify, una
 * alarma, etc. La rutina en sí se arma en la app de Alexa.
 *
 * Best-effort: si no está configurado o falla, devuelve ok:false sin tirar.
 */
export async function triggerAlexaRoutine(): Promise<VoiceMonkeyResult> {
  const token = process.env.VOICEMONKEY_TOKEN;
  const device = process.env.VOICEMONKEY_ROUTINE_DEVICE;

  if (!token || !device) {
    return { ok: false, error: "voicemonkey-routine-not-configured" };
  }

  try {
    const res = await fetch("https://api-v3.voicemonkey.io/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, device })
    });
    if (!res.ok) {
      return { ok: false, error: `voicemonkey-http-${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "voicemonkey-fetch-failed"
    };
  }
}
