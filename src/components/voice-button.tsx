"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { VoiceParseResult } from "@/src/domain/voice.ts";
import { VoiceConfirmationCard } from "./voice-confirmation-card";

type VoiceState = "idle" | "recording" | "processing" | "saving" | "result" | "error";

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

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <span className="text-xs font-bold tabular-nums text-[var(--primary)]">
      {mm}:{ss}
    </span>
  );
}

export function VoiceButton({ onSubmitAudio, onConfirm }: Props) {
  const [state, setState] = useState<VoiceState>("idle");
  const [recordingStart, setRecordingStart] = useState<number>(0);
  const [result, setResult] = useState<VoiceParseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function readableError(error: unknown, fallback: string) {
    return error instanceof Error && error.message.trim().length > 0
      ? error.message
      : fallback;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setState("processing");
        try {
          const parsed = await onSubmitAudio(blob);
          setResult(parsed);
          setState("result");
        } catch (error) {
          setErrorMsg(
            readableError(error, "No pude procesar el audio. Intentá de nuevo.")
          );
          setState("error");
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingStart(Date.now());
      setState("recording");
    } catch {
      setErrorMsg("No pude acceder al micrófono. Revisá los permisos.");
      setState("error");
    }
  }

  function stopRecording() {
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
