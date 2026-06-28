"use client";

import { useRouter } from "next/navigation";

import { confirmVoiceEventAction } from "@/app/actions";
import type { VoiceParseResult } from "@/src/domain/voice";
import { proposedToPendingForm, stashPendingForm } from "@/src/lib/pending-form";

import { VoiceButton } from "./voice-button";

/** Extensión de archivo según el mimeType real del audio (OpenAI la usa para decodificar). */
function audioFileName(blob: Blob) {
  const type = blob.type;
  const ext = type.includes("mp4")
    ? "mp4"
    : type.includes("ogg")
      ? "ogg"
      : type.includes("wav")
        ? "wav"
        : type.includes("mpeg")
          ? "mp3"
          : "webm";
  return `voice.${ext}`;
}

async function postVoiceParse(blob: Blob): Promise<VoiceParseResult> {
  const formData = new FormData();
  formData.append("audio", blob, audioFileName(blob));

  const response = await fetch("/api/voice/parse", {
    method: "POST",
    body: formData
  });
  const body = await response.json();

  if (!response.ok) {
    // El backend manda `errorCode` (estable). Lo propagamos para que el botón
    // de voz lo traduzca con el catálogo; caemos a "unknown" si no vino.
    const error = new Error(
      typeof body?.error === "string" ? body.error : "No pude procesar el audio."
    ) as Error & { code?: string };
    error.code = typeof body?.errorCode === "string" ? body.errorCode : "unknown";
    throw error;
  }

  return body as VoiceParseResult;
}

/** Simula POST /api/voice/parse para el preview (sin backend real). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function mockVoiceParse(_blob: Blob): Promise<VoiceParseResult> {
  await new Promise((r) => setTimeout(r, 1500));
  return {
    transcript:
      "Arrancó lactancia a las tres y diez, izquierda doce minutos, derecha ocho, alarma en dos horas y media.",
    intent: "register_feeding",
    confidence: 0.94,
    warnings: [],
    needsConfirmation: true,
    proposedEvent: {
      intent: "register_feeding",
      startedAtLocal: "2026-06-24T03:10",
      leftBreastUsed: true,
      rightBreastUsed: true,
      leftBreastMinutes: 12,
      rightBreastMinutes: 8,
      reminderOption: "2h30",
      reminderAtLocal: "2026-06-24T05:40"
    }
  };
}

/**
 * Botón de voz GLOBAL (vive en el shell, disponible en todas las tabs).
 *  - Confirmar: guarda el evento y refresca.
 *  - Editar: deja la propuesta en el handoff y navega a la sección del evento,
 *    donde el form se abre pre-cargado para ajustar antes de guardar.
 */
export function VoiceDock({ parser = "api" }: { parser?: "api" | "mock" }) {
  const router = useRouter();
  const submitVoiceAudio = parser === "mock" ? mockVoiceParse : postVoiceParse;
  const confirmVoiceEvent =
    parser === "mock"
      ? async () => {}
      : async (result: VoiceParseResult) => {
          await confirmVoiceEventAction(result);
          router.refresh();
        };

  return (
    <VoiceButton
      onSubmitAudio={submitVoiceAudio}
      onConfirm={confirmVoiceEvent}
      onEdit={(result) => {
        const pending = proposedToPendingForm(result);
        if (!pending) return;
        stashPendingForm(pending);
        router.push(`/${pending.section}`);
      }}
    />
  );
}
