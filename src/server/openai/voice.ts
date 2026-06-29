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
 *
 * Los recordatorios relativos se anclan al MOMENTO DEL AUDIO (`nowLocal`), no a
 * la hora de inicio de la toma: "recordame en 2 horas" significa 2 h desde que
 * el usuario habla. (Ej.: audio 19:30, "en 2 horas" -> 21:30, aunque la toma
 * haya empezado 19:00.)
 */
function resolveVoiceFeedingReminder(
  nowLocal: string,
  raw: {
    relativeMinutes?: number;
    atLocal?: string;
    option?: ReminderOption;
  }
): { option: ReminderOption; atLocal?: string } {
  // 1. "en X minutos/horas": el modelo dio los minutos crudos; la hora la
  //    calculamos desde AHORA (el momento del audio).
  if (raw.relativeMinutes != null && raw.relativeMinutes > 0) {
    return {
      option: "custom",
      atLocal: addMinutesToLocal(nowLocal, raw.relativeMinutes)
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

function normalizeProposedEvent(value: unknown, nowLocal: string): ProposedVoiceEvent {
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
      // Si no se dijo hora, asumimos AHORA (registro rápido): así no falla el
      // guardado por "faltan datos" cuando el audio no es estricto.
      eventTimeLocal: optionalString(event.eventTimeLocal) ?? nowLocal,
      diaperType: enumValue(event.diaperType, ["pee", "poop", "pee_poop", "dry"]),
      comment: optionalString(event.comment),
      abnormalFlag: optionalBoolean(event.abnormalFlag)
    };
  }

  if (event.intent === "register_feeding") {
    // Misma tolerancia: sin hora explícita, la toma es AHORA.
    const startedAtLocal = optionalString(event.startedAtLocal) ?? nowLocal;
    const reminder = resolveVoiceFeedingReminder(nowLocal, {
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
              "HORA DEL EVENTO (prioridad ESTRICTA para startedAtLocal/eventTimeLocal): " +
              "(a) Si el usuario menciona una hora EXPLÍCITA de la toma o pañal ('a las 15:40', 'tomó a las 3', 'cambié el pañal a las 9'), usá ESA hora. Una hora explícita SIEMPRE gana, aunque el audio también diga 'nueva toma', 'recién' o pida un recordatorio. " +
              "(b) Si NO hay hora explícita pero dice 'ahora'/'recién'/'nueva toma' o solo pide un recordatorio, usá AHORA (nowLocal). " +
              "(c) Si no se menciona ninguna hora, usá AHORA. Nunca dejes la hora vacía. " +
              "OJO: la hora del RECORDATORIO ('en dos horas') es independiente de la hora de la toma; no la uses como inicio. " +
              "RECORDATORIOS (importante, no calcules horas vos): " +
              "1) Si el usuario pide una alarma RELATIVA ('recordame en 5 minutos', 'en 2 horas', 'en una hora y media'), convertí ese lapso a MINUTOS totales y ponelo en reminderRelativeMinutes (ej: 'cinco minutos'->5, 'dos horas'->120, 'una hora y media'->90). El lapso es desde AHORA (el momento del audio). NO calcules la hora absoluta, NO uses reminderOption ni reminderAtLocal. " +
              "2) Si pide una HORA EXACTA para la alarma ('recordame a las 14:30'), ponela en reminderAtLocal y dejá reminderRelativeMinutes en null. " +
              "3) Solo usá reminderOption '2h'/'2h30'/'3h' si el usuario dice literalmente ese preset. " +
              "4) Si dice explícitamente que NO quiere alarma ('sin alarma'), reminderOption='none'. " +
              "5) Si NO menciona ninguna alarma, dejá reminderRelativeMinutes, reminderAtLocal y reminderOption todos en null (el servidor aplicará el default). " +
              "6) Si el usuario usa la app como recordatorio de la PRÓXIMA toma sin decir cuándo fue la última (ej. 'recordame en 2 horas que tiene que tomar la teta', 'avisame en 3 horas para la teta'), interpretalo como register_feeding con startedAtLocal=nowLocal (la toma fue ahora) y el lapso en reminderRelativeMinutes. No uses set_reminder para tomas. " +
              "Ejemplo: 'le di la teta a las 11:40 y recordame en cinco minutos' => register_feeding, startedAtLocal=...T11:40, reminderRelativeMinutes=5, reminderAtLocal=null, reminderOption=null. " +
              "Ejemplo: 'recordame en 2 horas que tome la teta' => register_feeding, startedAtLocal=nowLocal, reminderRelativeMinutes=120, reminderAtLocal=null, reminderOption=null. " +
              "Ejemplo (hora explícita gana sobre 'nueva toma'): 'Joaquín tomó a las 15:40, recordame en dos horas, nueva toma' => register_feeding, startedAtLocal=<hoy>T15:40, reminderRelativeMinutes=120, reminderAtLocal=null, reminderOption=null. " +
              "Si la transcripción tiene VARIAS señales de tiempo o queda ambigua sobre la hora de inicio, agregá un warning ('Revisá la hora de inicio') y bajá confidence a 0.6 o menos. " +
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

  const proposedEvent = normalizeProposedEvent(parsed.proposedEvent, nowLocal);

  return {
    transcript,
    intent: normalizeIntent(parsed.intent, proposedEvent),
    confidence: normalizeConfidence(parsed.confidence),
    warnings: normalizeWarnings(parsed.warnings),
    needsConfirmation: true,
    proposedEvent
  };
}
