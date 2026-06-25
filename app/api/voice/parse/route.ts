import { NextResponse } from "next/server";

import { getFamilyContext } from "@/src/data/context";
import { toArgentinaDateTimeLocal } from "@/src/domain/time";
import {
  extractVoiceEvent,
  transcribeVoiceAudio
} from "@/src/server/openai/voice";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      error: message,
      intent: "unknown",
      needsConfirmation: true
    },
    { status }
  );
}

export async function POST(request: Request) {
  const context = await getFamilyContext();

  if (context.status === "unauthenticated") {
    return jsonError("Tenés que iniciar sesión para usar voz.", 401);
  }

  if (context.status === "missing-family") {
    return jsonError("Falta configurar familia y bebé antes de usar voz.", 409);
  }

  const formData = await request.formData();
  const audio = formData.get("audio") ?? formData.get("file");

  if (!(audio instanceof File)) {
    return jsonError("Falta el archivo de audio.", 400);
  }

  if (audio.size === 0) {
    return jsonError("El audio está vacío.", 400);
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonError("El audio supera el límite de 25 MB.", 413);
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
    const message =
      error instanceof Error
        ? error.message
        : "No pude procesar el audio. Intentá de nuevo.";

    return jsonError(message, 500);
  }
}
