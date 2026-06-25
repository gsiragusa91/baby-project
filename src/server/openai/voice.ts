import {
  VOICE_EXTRACTION_JSON_SCHEMA,
  type ProposedVoiceEvent,
  type VoiceIntent,
  type VoiceParseResult
} from "@/src/domain/voice";

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
    throw new Error("Missing OPENAI_API_KEY.");
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
    return {
      intent: "register_feeding",
      startedAtLocal: optionalString(event.startedAtLocal),
      endedAtLocal: optionalString(event.endedAtLocal),
      leftBreastUsed: optionalBoolean(event.leftBreastUsed),
      rightBreastUsed: optionalBoolean(event.rightBreastUsed),
      leftBreastMinutes: optionalInteger(event.leftBreastMinutes),
      rightBreastMinutes: optionalInteger(event.rightBreastMinutes),
      notes: optionalString(event.notes),
      reminderOption: enumValue(event.reminderOption, ["2h", "2h30", "3h", "none"]),
      reminderAtLocal: optionalString(event.reminderAtLocal)
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
      reminderOption: enumValue(event.reminderOption, ["2h", "2h30", "3h", "none"]),
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

  const response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(await readOpenAIError(response));
  }

  const body = (await response.json()) as { text?: unknown };
  const transcript = optionalString(body.text);

  if (!transcript) {
    throw new Error("OpenAI no devolvió una transcripción usable.");
  }

  return transcript;
}

export async function extractVoiceEvent({
  babyName,
  nowLocal,
  transcript
}: ExtractVoiceEventParams): Promise<VoiceParseResult> {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
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
            "Usá solo datos presentes o inferencias temporales simples: ahora, recién, hace X minutos, a las HH:mm. " +
            "Para horas ambiguas como 'a las tres', elegí la ocurrencia plausible más reciente dentro de las últimas 12 horas y agregá un warning. " +
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

  if (!response.ok) {
    throw new Error(await readOpenAIError(response));
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  const raw = typeof content === "string" ? JSON.parse(content) : content;
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
