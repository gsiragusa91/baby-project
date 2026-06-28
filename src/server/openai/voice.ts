import {
  DEFAULT_FEEDING_REMINDER,
  addMinutesToLocal
} from "@/src/domain/reminders";
import type { ReminderOption } from "@/src/domain/types";
import {
  VOICE_EXTRACTION_JSON_SCHEMA,
  type ProposedVoiceEvent,
  type VoiceIntent,
  type VoiceParseResult
} from "@/src/domain/voice";
import { VoiceError, type VoiceErrorCode } from "@/src/domain/voice-errors";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const DEFAULT_EXTRACTION_MODEL = "gpt-4o-mini";

type OpenAIJson = Record<string, unknown>;

type ExtractVoiceEventParams = {
  transcript: string;
  nowLocal: string;
  babyName: string;
};

function getOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new VoiceError("openai_auth", "Missing OPENAI_API_KEY.");
  }

  return apiKey;
}

async function readOpenAIError(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

/**
 * Traduce un status HTTP de OpenAI a uno de nuestros códigos de error de voz.
 * `fallback` distingue si la falla fue transcribiendo o extrayendo.
 */
function openAIStatusToCode(
  status: number,
  fallback: VoiceErrorCode
): VoiceErrorCode {
  if (status === 401 || status === 403) return "openai_auth";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "openai_unavailable";
  return fallback;
}

function asRecord(value: unknown): OpenAIJson | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as OpenAIJson;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function optionalInteger(value: unknown) {
  return Number.isInteger(value) ? (value as number) : undefined;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | undefined {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : undefined;
}

/**
 * Resuelve la alarma de una toma a partir de lo que extrajo el LLM, calculando
 * la hora absoluta en CÓDIGO (no confiamos la aritmética de tiempo al modelo).
 * Prioridad: relativo ("en 5 min") > hora absoluta > preset literal > "sin
 * alarma" explícito > default (cuando el usuario no mencionó nada).
 */
function resolveVoiceFeedingReminder(
  startedAtLocal: string | undefined,
  raw: {
    relativeMinutes?: number;
    atLocal?: string;
    option?: ReminderOption;
  }
): { option: ReminderOption; atLocal?: string } {
  // 1. "en X minutos/horas": el modelo dio los minutos crudos, nosotros la hora.
  if (raw.relativeMinutes != null && raw.relativeMinutes > 0 && startedAtLocal) {
    return {
      option: "custom",
      atLocal: addMinutesToLocal(startedAtLocal, raw.relativeMinutes)
    };
  }

  // 2. Hora absoluta explícita ("recordame a las 14").
  if (raw.atLocal) {
    return { option: "custom", atLocal: raw.atLocal };
  }

  // 3. Preset dicho literalmente.
  if (raw.option === "2h" || raw.option === "2h30" || raw.option === "3h") {
    return { option: raw.option };
  }

  // 4. "Sin alarma" explícito.
  if (raw.option === "none") {
    return { option: "none" };
  }

  // 5. No se mencionó alarma -> default (consistente con el form manual).
  return { option: DEFAULT_FEEDING_REMINDER };
}

function normalizeProposedEvent(value: unknown): ProposedVoiceEvent {
  const event = asRecord(value);

  if (!event) {
    return {
      intent: "unknown",
      reason: "No pude convertir la transcripción en un evento."
    };
  }

  if (event.intent === "register_diaper") {
    return {
      intent: "register_diaper",
      eventTimeLocal: optionalString(event.eventTimeLocal),
      diaperType: enumValue(event.diaperType, ["pee", "poop", "pee_poop", "dry"]),
      comment: optionalString(event.comment),
      abnormalFlag: optionalBoolean(event.abnormalFlag)
    };
  }

  if (event.intent === "register_feeding") {
    const startedAtLocal = optionalString(event.startedAtLocal);
    const reminder = resolveVoiceFeedingReminder(startedAtLocal, {
      relativeMinutes: optionalInteger(event.reminderRelativeMinutes),
      atLocal: optionalString(event.reminderAtLocal),
      option: enumValue(event.reminderOption, ["2h", "2h30", "3h", "none", "custom"])
    });

    return {
      intent: "register_feeding",
      startedAtLocal,
      endedAtLocal: optionalString(event.endedAtLocal),
      leftBreastUsed: optionalBoolean(event.leftBreastUsed),
      rightBreastUsed: optionalBoolean(event.rightBreastUsed),
      leftBreastMinutes: optionalInteger(event.leftBreastMinutes),
      rightBreastMinutes: optionalInteger(event.rightBreastMinutes),
      notes: optionalString(event.notes),
      reminderOption: reminder.option,
      reminderAtLocal: reminder.atLocal
    };
  }

  if (event.intent === "create_question") {
    const text = optionalString(event.text);

    if (!text) {
      return {
        intent: "unknown",
        reason: "Detecté una duda, pero faltó el texto de la pregunta."
      };
    }

    return {
      intent: "create_question",
      text,
      category: enumValue(event.category, [
        "feeding",
        "diaper",
        "sleep",
        "weight",
        "skin",
        "umbilical_cord",
        "medication",
        "other"
      ]),
      professional: enumValue(event.professional, [
        "pediatrician",
        "neonatologist",
        "lactation_consultant",
        "other"
      ]),
      priority: enumValue(event.priority, ["normal", "next_visit", "urgent"])
    };
  }

  if (event.intent === "set_reminder") {
    return {
      intent: "set_reminder",
      reminderOption: enumValue(event.reminderOption, ["2h", "2h30", "3h", "none", "custom"]),
      remindAtLocal: optionalString(event.remindAtLocal),
      relatedEventType: enumValue(event.relatedEventType, ["feeding", "sleep", "other"])
    };
  }

  return {
    intent: "unknown",
    reason:
      optionalString(event.reason) ??
      "No pude identificar si era pañal, lactancia, duda o recordatorio."
  };
}

function normalizeIntent(value: unknown, proposedEvent: ProposedVoiceEvent): VoiceIntent {
  const intent = enumValue(value, [
    "register_diaper",
    "register_feeding",
    "create_question",
    "set_reminder",
    "unknown"
  ]);

  if (!intent || intent !== proposedEvent.intent) {
    return proposedEvent.intent;
  }

  return intent;
}

function normalizeWarnings(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => optionalString(item))
    .filter((item): item is string => Boolean(item));
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

export async function transcribeVoiceAudio(file: File) {
  const formData = new FormData();
  formData.append("file", file, file.name || "voice.webm");
  formData.append(
    "model",
    process.env.OPENAI_TRANSCRIPTION_MODEL ?? DEFAULT_TRANSCRIPTION_MODEL
  );
  formData.append("response_format", "json");
  formData.append("language", "es");

  let response: Response;
  try {
    response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAIKey()}`
      },
      body: formData
    });
  } catch (cause) {
    // fetch solo rechaza por problemas de red/DNS, no por status HTTP.
    throw new VoiceError("network", `No se pudo contactar OpenAI: ${String(cause)}`);
  }

  if (!response.ok) {
    throw new VoiceError(
      openAIStatusToCode(response.status, "transcription_failed"),
      await readOpenAIError(response)
    );
  }

  const body = (await response.json()) as { text?: unknown };
  const transcript = optionalString(body.text);

  if (!transcript) {
    throw new VoiceError("transcription_empty");
  }

  return transcript;
}

export async function extractVoiceEvent({
  babyName,
  nowLocal,
  transcript
}: ExtractVoiceEventParams): Promise<VoiceParseResult> {
  let response: Response;
  try {
    response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAIKey()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VOICE_EXTRACTION_MODEL ?? DEFAULT_EXTRACTION_MODEL,
        temperature: 0,
        store: false,
        messages: [
          {
            role: "system",
            content:
              "Sos un parser de registros de un bebé recién nacido. No das consejos médicos. " +
              "Tu tarea es convertir una transcripción corta en un único evento estructurado para que el usuario lo confirme. " +
              "Interpretá los campos principales y completá (inferí) los que se deducen sin inventar datos que no estén. " +
              "Usá solo datos presentes o inferencias temporales simples: ahora, recién, hace X minutos, a las HH:mm. " +
              "Para horas ambiguas como 'a las tres', elegí la ocurrencia plausible más reciente dentro de las últimas 12 horas y agregá un warning. " +
              "RECORDATORIOS (importante, no calcules horas vos): " +
              "1) Si el usuario pide una alarma RELATIVA ('recordame en 5 minutos', 'en 2 horas', 'en una hora y media'), convertí ese lapso a MINUTOS totales y ponelo en reminderRelativeMinutes (ej: 'cinco minutos'->5, 'dos horas'->120, 'una hora y media'->90). NO calcules la hora absoluta, NO uses reminderOption ni reminderAtLocal. " +
              "2) Si pide una HORA EXACTA para la alarma ('recordame a las 14:30'), ponela en reminderAtLocal y dejá reminderRelativeMinutes en null. " +
              "3) Solo usá reminderOption '2h'/'2h30'/'3h' si el usuario dice literalmente ese preset. " +
              "4) Si dice explícitamente que NO quiere alarma ('sin alarma'), reminderOption='none'. " +
              "5) Si NO menciona ninguna alarma, dejá reminderRelativeMinutes, reminderAtLocal y reminderOption todos en null (el servidor aplicará el default). " +
              "Ejemplo: 'le di la teta a las 11:40 y recordame en cinco minutos' => register_feeding, startedAtLocal=...T11:40, reminderRelativeMinutes=5, reminderAtLocal=null, reminderOption=null. " +
              "No inventes duraciones, tipo de pañal, profesional ni alarmas si no aparecen. " +
              "Los campos *Local deben usar formato YYYY-MM-DDTHH:mm en America/Argentina/Buenos_Aires."
          },
          {
            role: "user",
            content: JSON.stringify({
              babyName,
              timezone: "America/Argentina/Buenos_Aires",
              nowLocal,
              transcript
            })
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "baby_voice_event",
            strict: true,
            schema: VOICE_EXTRACTION_JSON_SCHEMA
          }
        }
      })
    });
  } catch (cause) {
    throw new VoiceError("network", `No se pudo contactar OpenAI: ${String(cause)}`);
  }

  if (!response.ok) {
    throw new VoiceError(
      openAIStatusToCode(response.status, "extraction_failed"),
      await readOpenAIError(response)
    );
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  let raw: unknown;
  try {
    raw = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    throw new VoiceError("extraction_invalid", "OpenAI devolvió un JSON inválido.");
  }
  const parsed = asRecord(raw);

  if (!parsed) {
    return {
      transcript,
      intent: "unknown",
      confidence: 0,
      warnings: ["OpenAI devolvió una respuesta vacía o inválida."],
      needsConfirmation: true,
      proposedEvent: {
        intent: "unknown",
        reason: "No pude interpretar el audio."
      }
    };
  }

  const proposedEvent = normalizeProposedEvent(parsed.proposedEvent);

  return {
    transcript,
    intent: normalizeIntent(parsed.intent, proposedEvent),
    confidence: normalizeConfidence(parsed.confidence),
    warnings: normalizeWarnings(parsed.warnings),
    needsConfirmation: true,
    proposedEvent
  };
}
