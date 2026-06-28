"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { VoiceParseResult } from "@/src/domain/voice.ts";
import { voiceErrorInfo } from "@/src/domain/voice-errors";
import { getMicStream, setMicCapturing } from "@/src/lib/mic";
import { VoiceConfirmationCard } from "./voice-confirmation-card";

type VoiceState = "idle" | "recording" | "processing" | "saving" | "result" | "error";

/** Tope de grabación. Un audio corto alcanza para un evento y evita gastar
 *  tokens de más en la transcripción (OpenAI cobra por duración). Al llegar
 *  al límite, la grabación se corta sola y sigue el flujo normal de parseo. */
const MAX_RECORDING_SECONDS = 15;

type Props = {
  /**
   * Llamado con el blob de audio cuando el usuario termina de grabar.
   * En preview se pasa un mock que devuelve un resultado falso.
   * En producción conecta con POST /api/voice/parse (Workstream 4).
   */
  onSubmitAudio: (blob: Blob) => Promise<VoiceParseResult>;
  /**
   * Llamado cuando el usuario confirma el evento propuesto.
   * Por ahora solo cierra la tarjeta; en producción dispara la server action.
   */
  onConfirm?: (result: VoiceParseResult) => Promise<void> | void;
  /**
   * Llamado cuando el usuario toca "Editar" en la tarjeta: el padre abre el
   * form de alta pre-cargado para que ajuste antes de guardar.
   */
  onEdit?: (result: VoiceParseResult) => void;
};

function PulsingRing() {
  return (
    <span className="absolute inset-0 rounded-[var(--radius-md)] animate-ping bg-[var(--primary)] opacity-25" />
  );
}

function RecordingTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const remaining = Math.max(0, MAX_RECORDING_SECONDS - elapsed);
  // En los últimos 5s avisamos que se viene el corte: contador en rojo.
  const isEnding = remaining <= 5;

  if (isEnding) {
    return (
      <span className="text-xs font-bold tabular-nums text-[var(--danger)]">
        Corta en {remaining}s
      </span>
    );
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <span className="text-xs font-bold tabular-nums text-[var(--primary)]">
      {mm}:{ss}
    </span>
  );
}

export function VoiceButton({ onSubmitAudio, onConfirm, onEdit }: Props) {
  const [state, setState] = useState<VoiceState>("idle");
  const [recordingStart, setRecordingStart] = useState<number>(0);
  const [result, setResult] = useState<VoiceParseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Timer que corta la grabación al llegar a MAX_RECORDING_SECONDS.
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function readableError(error: unknown, fallback: string) {
    return error instanceof Error && error.message.trim().length > 0
      ? error.message
      : fallback;
  }

  /** Traduce un error del flujo de voz a un mensaje del catálogo, usando el
   *  `code` que viaja en el error (lo setea postVoiceParse desde errorCode). */
  function describeParseError(error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "unknown";
    const info = voiceErrorInfo(code);
    return info.hint ? `${info.message} ${info.hint}` : info.message;
  }

  async function startRecording() {
    try {
      // Reusamos el stream del mic (no re-pide permiso en cada grabación).
      const stream = await getMicStream();
      setMicCapturing(true); // habilitamos la captura solo mientras grabamos
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // NO soltamos el stream: lo muteamos para conservar el permiso y reusarlo.
        setMicCapturing(false);
        // Usamos el mimeType REAL que eligió el navegador (Chrome→webm, Safari→mp4),
        // no uno hardcodeado. Si no, OpenAI recibe bytes de un formato con la
        // etiqueta de otro y los rechaza como "corrupted or unsupported".
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setState("processing");
        try {
          const parsed = await onSubmitAudio(blob);
          setResult(parsed);
          setState("result");
        } catch (error) {
          setErrorMsg(describeParseError(error));
          setState("error");
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingStart(Date.now());
      setState("recording");
      // Corte automático al tope: dispara stopRecording, que sigue el flujo
      // normal (onstop → procesar). clearTimeout en stop evita doble corte.
      autoStopRef.current = setTimeout(stopRecording, MAX_RECORDING_SECONDS * 1000);
    } catch {
      const info = voiceErrorInfo("mic_permission");
      setErrorMsg(info.hint ? `${info.message} ${info.hint}` : info.message);
      setState("error");
    }
  }

  function stopRecording() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }

  function reset() {
    setResult(null);
    setErrorMsg("");
    setState("idle");
  }

  if (state === "result" && result) {
    // La tarjeta de confirmación se muestra como bottom-sheet fixed (overlay
    // a nivel viewport), no en el lugar del botón. Así no queda atrapada dentro
    // de la pill del nav. La lógica de guardado/descarte se mantiene intacta.
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-5 backdrop-blur-sm">
        <div className="w-full max-w-[420px]">
          <VoiceConfirmationCard
            result={result}
            onConfirm={async () => {
              setState("saving");
              try {
                await onConfirm?.(result);
                reset();
              } catch (error) {
                setErrorMsg(
                  readableError(error, "No pude guardar el registro. Intentá de nuevo.")
                );
                setState("error");
              }
            }}
            onEdit={
              onEdit
                ? () => {
                    onEdit(result);
                    reset();
                  }
                : undefined
            }
            onDiscard={reset}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center gap-0.5">
      {/* Status como pop-up flotante (absolute): NO empuja la barra de nav.
          Aparece arriba del chip, anclado a la derecha para no salirse del borde. */}
      {state !== "idle" && (
        <div className="absolute bottom-full right-0 mb-2 w-max max-w-[220px] rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1.5 text-right shadow-lg">
          {state === "error" && (
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-xs font-semibold text-[var(--danger)]">{errorMsg}</span>
              <button
                type="button"
                onClick={startRecording}
                className="rounded-full bg-[var(--primary)] px-3 py-1 text-[11px] font-bold text-[var(--primary-ink)]"
              >
                Permitir y reintentar
              </button>
            </div>
          )}
          {state === "recording" && <RecordingTimer startedAt={recordingStart} />}
          {state === "processing" && (
            <span className="text-xs font-semibold text-[var(--ink-soft)] animate-pulse">
              Procesando…
            </span>
          )}
          {state === "saving" && (
            <span className="text-xs font-semibold text-[var(--ink-soft)] animate-pulse">
              Guardando…
            </span>
          )}
        </div>
      )}

      <div className="relative flex items-center justify-center">
        {state === "recording" && <PulsingRing />}

        <button
          aria-label={state === "recording" ? "Detener grabación" : "Grabar audio"}
          disabled={state === "processing" || state === "saving"}
          className={[
            "relative z-10 flex items-center justify-center rounded-[var(--radius-md)] transition-transform active:scale-95",
            "w-[50px] h-[50px]",
            state === "recording"
              ? "bg-[var(--danger)] text-white"
              : state === "processing" || state === "saving"
              ? "bg-[var(--surface-strong)] text-[var(--ink-soft)] cursor-wait"
              : "bg-[var(--primary)] text-[var(--primary-ink)] mic-glow"
          ].join(" ")}
          type="button"
          onClick={state === "recording" ? stopRecording : startRecording}
        >
          {state === "recording" ? <Square size={18} fill="currentColor" /> : <Mic size={22} />}
        </button>
      </div>
    </div>
  );
}
