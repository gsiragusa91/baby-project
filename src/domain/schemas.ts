import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const authCredentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(72)
});

export const onboardingInputSchema = z.object({
  familyName: z.string().trim().max(80).optional(),
  babyName: z.string().trim().min(1).max(80),
  babyBirthDate: isoDateSchema.refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    return !Number.isNaN(date.getTime()) && date <= today;
  })
});

export const familyInviteInputSchema = z.object({
  invitedEmail: z.string().trim().email().max(320),
  role: z.enum(["parent", "caregiver", "viewer"]).default("parent")
});

export const joinFamilyInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(24)
    .transform((value) => value.replace(/\s+/g, "").toUpperCase())
});

const idSchema = z.string().uuid();

/** Para borrar cualquier registro: solo necesitamos su id. */
export const deleteByIdSchema = z.object({ id: idSchema });

export const diaperEventInputSchema = z.object({
  diaperType: z.enum(["pee", "poop", "pee_poop", "dry"]),
  eventTime: z.string().min(1),
  comment: z.string().max(500).optional(),
  abnormalFlag: z.boolean().default(false)
});

export const diaperEventEditSchema = diaperEventInputSchema.extend({
  id: idSchema
});

const optionalMinutes = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return Number(value);
}, z.number().int().min(0).max(240).optional());

const optionalLocalDateTime = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }
  return value;
}, z.string().optional());

export const feedingEventInputSchema = z.object({
  startedAt: z.string().min(1),
  leftBreastUsed: z.boolean().default(false),
  rightBreastUsed: z.boolean().default(false),
  leftBreastMinutes: optionalMinutes,
  rightBreastMinutes: optionalMinutes,
  notes: z.string().max(500).optional(),
  reminderOption: z.enum(["2h", "2h30", "3h", "none", "custom"]).default("2h30"),
  // Hora exacta de la alarma (datetime-local). Si viene, manda sobre el preset
  // y el evento se guarda con reminder_option = 'custom'.
  customReminderAt: optionalLocalDateTime
});

export const feedingEventEditSchema = feedingEventInputSchema.extend({
  id: idSchema
});

export const questionInputSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  category: z.enum([
    "feeding",
    "diaper",
    "sleep",
    "weight",
    "skin",
    "umbilical_cord",
    "medication",
    "other"
  ]),
  professional: z.enum([
    "pediatrician",
    "neonatologist",
    "lactation_consultant",
    "other"
  ]),
  priority: z.enum(["normal", "next_visit", "urgent"])
});

export const questionEditSchema = questionInputSchema.extend({
  id: idSchema
});
