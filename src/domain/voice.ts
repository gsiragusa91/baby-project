import type {
  DiaperType,
  Professional,
  QuestionCategory,
  QuestionPriority,
  ReminderOption
} from "./types";

export type VoiceIntent =
  | "register_diaper"
  | "register_feeding"
  | "create_question"
  | "set_reminder"
  | "unknown";

export type ProposedDiaperEvent = {
  intent: "register_diaper";
  eventTimeLocal?: string;
  diaperType?: DiaperType;
  comment?: string;
  abnormalFlag?: boolean;
};

export type ProposedFeedingEvent = {
  intent: "register_feeding";
  startedAtLocal?: string;
  endedAtLocal?: string;
  leftBreastUsed?: boolean;
  rightBreastUsed?: boolean;
  leftBreastMinutes?: number;
  rightBreastMinutes?: number;
  notes?: string;
  reminderOption?: ReminderOption;
  reminderAtLocal?: string;
};

export type ProposedQuestion = {
  intent: "create_question";
  text: string;
  category?: QuestionCategory;
  professional?: Professional;
  priority?: QuestionPriority;
};

export type ProposedReminder = {
  intent: "set_reminder";
  reminderOption?: ReminderOption;
  remindAtLocal?: string;
  relatedEventType?: "feeding" | "sleep" | "other";
};

export type UnknownVoiceEvent = {
  intent: "unknown";
  reason: string;
};

export type ProposedVoiceEvent =
  | ProposedDiaperEvent
  | ProposedFeedingEvent
  | ProposedQuestion
  | ProposedReminder
  | UnknownVoiceEvent;

export type VoiceParseResult = {
  transcript: string;
  intent: VoiceIntent;
  confidence: number;
  proposedEvent: ProposedVoiceEvent;
  warnings: string[];
  needsConfirmation: true;
};

export type VoiceParseError = {
  error: string;
  transcript?: string;
  intent: "unknown";
  warnings?: string[];
  needsConfirmation: true;
};

export const VOICE_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "confidence", "proposedEvent", "warnings"],
  properties: {
    intent: {
      type: "string",
      enum: [
        "register_diaper",
        "register_feeding",
        "create_question",
        "set_reminder",
        "unknown"
      ]
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    warnings: {
      type: "array",
      items: { type: "string" }
    },
    proposedEvent: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: [
            "intent",
            "eventTimeLocal",
            "diaperType",
            "comment",
            "abnormalFlag"
          ],
          properties: {
            intent: { type: "string", const: "register_diaper" },
            eventTimeLocal: { type: ["string", "null"] },
            diaperType: {
              type: ["string", "null"],
              enum: ["pee", "poop", "pee_poop", "dry", null]
            },
            comment: { type: ["string", "null"] },
            abnormalFlag: { type: ["boolean", "null"] }
          }
        },
        {
          type: "object",
          additionalProperties: false,
          required: [
            "intent",
            "startedAtLocal",
            "endedAtLocal",
            "leftBreastUsed",
            "rightBreastUsed",
            "leftBreastMinutes",
            "rightBreastMinutes",
            "notes",
            "reminderOption",
            "reminderAtLocal"
          ],
          properties: {
            intent: { type: "string", const: "register_feeding" },
            startedAtLocal: { type: ["string", "null"] },
            endedAtLocal: { type: ["string", "null"] },
            leftBreastUsed: { type: ["boolean", "null"] },
            rightBreastUsed: { type: ["boolean", "null"] },
            leftBreastMinutes: {
              type: ["integer", "null"],
              minimum: 0,
              maximum: 240
            },
            rightBreastMinutes: {
              type: ["integer", "null"],
              minimum: 0,
              maximum: 240
            },
            notes: { type: ["string", "null"] },
            reminderOption: {
              type: ["string", "null"],
              enum: ["2h", "2h30", "3h", "none", null]
            },
            reminderAtLocal: { type: ["string", "null"] }
          }
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["intent", "text", "category", "professional", "priority"],
          properties: {
            intent: { type: "string", const: "create_question" },
            text: { type: "string" },
            category: {
              type: ["string", "null"],
              enum: [
                "feeding",
                "diaper",
                "sleep",
                "weight",
                "skin",
                "umbilical_cord",
                "medication",
                "other",
                null
              ]
            },
            professional: {
              type: ["string", "null"],
              enum: [
                "pediatrician",
                "neonatologist",
                "lactation_consultant",
                "other",
                null
              ]
            },
            priority: {
              type: ["string", "null"],
              enum: ["normal", "next_visit", "urgent", null]
            }
          }
        },
        {
          type: "object",
          additionalProperties: false,
          required: [
            "intent",
            "reminderOption",
            "remindAtLocal",
            "relatedEventType"
          ],
          properties: {
            intent: { type: "string", const: "set_reminder" },
            reminderOption: {
              type: ["string", "null"],
              enum: ["2h", "2h30", "3h", "none", null]
            },
            remindAtLocal: { type: ["string", "null"] },
            relatedEventType: {
              type: ["string", "null"],
              enum: ["feeding", "sleep", "other", null]
            }
          }
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["intent", "reason"],
          properties: {
            intent: { type: "string", const: "unknown" },
            reason: { type: "string" }
          }
        }
      ]
    }
  }
} as const;
