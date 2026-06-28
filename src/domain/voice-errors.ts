/**
 * Catálogo único de errores de voz.
 *
 * Antes, cualquier falla del flujo de voz (mic, audio vacío, OpenAI caído, JSON
 * inválido) terminaba como un 500 genérico que filtraba el mensaje crudo de
 * OpenAI a la pantalla. Eso explicaba los "errores diferentes" que veía el
 * usuario. Acá cada falla tiene un código estable, un mensaje claro en español,
 * una pista de qué hacer y si conviene reintentar.
 *
 * El backend (route + openai) clasifica y devuelve `errorCode`; el cliente lo
 * traduce a este catálogo. Así el mensaje es consistente venga de donde venga.
 */

export type VoiceErrorCode =
  // Sesión / configuración
  | "unauthenticated"
  | "missing_family"
  // Audio enviado por el cliente
  | "no_audio"
  | "empty_audio"
  | "audio_too_large"
  | "mic_permission"
  // Transcripción (speech-to-text)
  | "transcription_failed"
  | "transcription_empty"
  // Extracción (texto -> evento estructurado)
  | "extraction_failed"
  | "extraction_invalid"
  // OpenAI / red (transversales)
  | "rate_limited"
  | "openai_auth"
  | "openai_unavailable"
  | "network"
  | "unknown";

export type VoiceErrorInfo = {
  /** Mensaje principal mostrado al usuario. */
  message: string;
  /** Pista opcional sobre cómo resolverlo. */
  hint?: string;
  /** Si tiene sentido ofrecer "reintentar". */
  retryable: boolean;
};

export const VOICE_ERRORS: Record<VoiceErrorCode, VoiceErrorInfo> = {
  unauthenticated: {
    message: "Iniciá sesión para usar la voz.",
    retryable: false
  },
  missing_family: {
    message: "Primero configurá la familia y el bebé.",
    retryable: false
  },
  no_audio: {
    message: "No llegó ningún audio.",
    hint: "Mantené presionado para grabar y soltá al terminar.",
    retryable: true
  },
  empty_audio: {
    message: "La grabación quedó vacía.",
    hint: "Probá grabar de nuevo hablando un poco más.",
    retryable: true
  },
  audio_too_large: {
    message: "El audio es demasiado largo.",
    hint: "Grabá un mensaje más corto (menos de 25 MB).",
    retryable: true
  },
  mic_permission: {
    message: "No pude acceder al micrófono.",
    hint: "Revisá los permisos del micrófono y reintentá.",
    retryable: true
  },
  transcription_failed: {
    message: "No pude entender el audio.",
    hint: "Probá hablar más claro o en un lugar con menos ruido.",
    retryable: true
  },
  transcription_empty: {
    message: "No se escuchó nada en la grabación.",
    hint: "Acercá el micrófono y volvé a intentar.",
    retryable: true
  },
  extraction_failed: {
    message: "No pude interpretar lo que dijiste.",
    hint: "Decilo de otra forma, por ejemplo: «le di la teta a las 9, recordame en 2 horas».",
    retryable: true
  },
  extraction_invalid: {
    message: "Entendí el audio pero no pude estructurarlo.",
    hint: "Reintentá; si sigue fallando, cargalo a mano.",
    retryable: true
  },
  rate_limited: {
    message: "Hay demasiados pedidos por ahora.",
    hint: "Esperá unos segundos y reintentá.",
    retryable: true
  },
  openai_auth: {
    message: "Hay un problema de configuración del servicio de voz.",
    hint: "Avisale al admin (falta o venció la API key).",
    retryable: false
  },
  openai_unavailable: {
    message: "El servicio de voz no está disponible ahora.",
    hint: "Reintentá en un rato.",
    retryable: true
  },
  network: {
    message: "Problema de conexión.",
    hint: "Revisá tu internet y reintentá.",
    retryable: true
  },
  unknown: {
    message: "No pude procesar el audio.",
    hint: "Intentá de nuevo.",
    retryable: true
  }
};

/** Devuelve la info del error, cayendo a `unknown` si el código no se reconoce. */
export function voiceErrorInfo(code: string | null | undefined): VoiceErrorInfo {
  if (code && code in VOICE_ERRORS) {
    return VOICE_ERRORS[code as VoiceErrorCode];
  }
  return VOICE_ERRORS.unknown;
}

/**
 * Error de voz tipado, para lanzar desde el servidor con un código estable.
 * El route lo atrapa y lo convierte en la respuesta JSON estructurada.
 */
export class VoiceError extends Error {
  code: VoiceErrorCode;

  constructor(code: VoiceErrorCode, message?: string) {
    super(message ?? VOICE_ERRORS[code].message);
    this.name = "VoiceError";
    this.code = code;
  }
}
