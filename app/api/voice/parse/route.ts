import { NextResponse } from "next/server";

import { getFamilyContext } from "@/src/data/context";
import { toArgentinaDateTimeLocal } from "@/src/domain/time";
import {
  VOICE_ERRORS,
  VoiceError,
  type VoiceErrorCode
} from "@/src/domain/voice-errors";
import {
  extractVoiceEvent,
  transcribeVoiceAudio
} from "@/src/server/openai/voice";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const runtime = "nodejs";

// HTTP status sugerido por código (el cliente igual decide por errorCode).
const STATUS_BY_CODE: Partial<Record<VoiceErrorCode, number>> = {
  unauthenticated: 401,
  missing_family: 409,
  no_audio: 400,
  empty_audio: 400,
  audio_too_large: 413,
  rate_limited: 429,
  openai_auth: 502,
  openai_unavailable: 502,
  network: 502
};

/**
 * Respuesta de error estructurada. Siempre devuelve `errorCode` (estable, para
 * lógica) y `error` (mensaje legible del catálogo). `intent: unknown` mantiene
 * la forma que el cliente ya espera.
 */
function jsonError(code: VoiceErrorCode, status?: number) {
  return NextResponse.json(
    {
      errorCode: code,
      error: VOICE_ERRORS[code].message,
      intent: "unknown",
      needsConfirmation: true
    },
    { status: status ?? STATUS_BY_CODE[code] ?? 500 }
  );
}

export async function POST(request: Request) {
  const context = await getFamilyContext();

  if (context.status === "unauthenticated") {
    return jsonError("unauthenticated");
  }

  if (context.status === "missing-family") {
    return jsonError("missing_family");
  }

  const formData = await request.formData();
  const audio = formData.get("audio") ?? formData.get("file");

  if (!(audio instanceof File)) {
    return jsonError("no_audio");
  }

  if (audio.size === 0) {
    return jsonError("empty_audio");
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonError("audio_too_large");
  }

  try {
    const transcript = await transcribeVoiceAudio(audio);
    const result = await extractVoiceEvent({
      transcript,
      babyName: context.baby.name,
      nowLocal: toArgentinaDateTimeLocal()
    });

    return NextResponse.json(result);
  } catch (error) {
    // Errores tipados desde la capa de OpenAI: respetamos su código.
    // Cualquier otra cosa cae en "unknown" y se loguea para diagnóstico.
    if (error instanceof VoiceError) {
      return jsonError(error.code);
    }

    console.error("[voice/parse] error inesperado:", error);
    return jsonError("unknown");
  }
}
