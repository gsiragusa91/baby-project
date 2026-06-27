/**
 * Canal Alexa vía Voice Monkey.
 *
 * Voice Monkey es un puente: vinculás tu Echo a su skill y, con un request HTTP,
 * hacés que Alexa "anuncie" un texto por voz en ese dispositivo. No es una alarma
 * nativa de Alexa (eso no tiene API pública), es un anuncio hablado en el momento.
 *
 * El endpoint v3 /announcement acepta token + device + text como query params.
 * Docs: https://voicemonkey.io/docs
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

  const url = new URL("https://api-v3.voicemonkey.io/announcement");
  url.searchParams.set("token", token);
  url.searchParams.set("device", device);
  url.searchParams.set("text", text);

  try {
    const res = await fetch(url, { method: "GET" });
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
