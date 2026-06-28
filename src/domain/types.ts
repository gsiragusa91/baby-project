export type ReminderOption = "2h" | "2h30" | "3h" | "none" | "custom";
export type EventSource = "manual" | "voice";

export type Family = {
  id: string;
  createdAt: string;
  name?: string | null;
};

export type FamilyMemberRole = "parent" | "caregiver" | "viewer";

export type FamilyMember = {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyMemberRole;
  createdAt: string;
};

export type FamilyInvite = {
  id: string;
  familyId: string;
  code: string;
  invitedEmail: string;
  role: FamilyMemberRole;
  createdByUserId: string;
  createdAt: string;
  expiresAt: string;
  usedByUserId?: string | null;
  usedAt?: string | null;
};

export type Baby = {
  id: string;
  name: string;
  birthDate: string;
  createdAt: string;
  familyId: string;
};

export type DiaperType = "pee" | "poop" | "pee_poop" | "dry";

export type DiaperEvent = {
  id: string;
  babyId: string;
  familyId: string;
  createdByUserId: string;
  createdAt: string;
  eventTime: string;
  diaperType: DiaperType;
  comment?: string | null;
  /** Path del objeto en Storage (lo que se persiste en DB). */
  photoUrl?: string | null;
  /** Signed URL resuelta en la capa de datos para render (transitorio). */
  photoSignedUrl?: string | null;
  abnormalFlag: boolean;
  source: EventSource;
  transcript?: string | null;
};

export type FeedingEvent = {
  id: string;
  babyId: string;
  familyId: string;
  createdByUserId: string;
  createdAt: string;
  startedAt: string;
  endedAt?: string | null;
  leftBreastUsed?: boolean | null;
  rightBreastUsed?: boolean | null;
  leftBreastMinutes?: number | null;
  rightBreastMinutes?: number | null;
  notes?: string | null;
  reminderOption?: ReminderOption | null;
  reminderAt?: string | null;
  source: EventSource;
  transcript?: string | null;
};

export type QuestionCategory =
  | "feeding"
  | "diaper"
  | "sleep"
  | "weight"
  | "skin"
  | "umbilical_cord"
  | "medication"
  | "other";

export type Professional =
  | "pediatrician"
  | "neonatologist"
  | "lactation_consultant"
  | "other";

export type QuestionPriority = "normal" | "next_visit" | "urgent";
export type QuestionStatus = "pending" | "answered";

export type Question = {
  id: string;
  babyId: string;
  familyId: string;
  createdByUserId: string;
  createdAt: string;
  text: string;
  category: QuestionCategory;
  professional: Professional;
  status: QuestionStatus;
  priority: QuestionPriority;
  answer?: string | null;
  /** Path del objeto en Storage (lo que se persiste en DB). */
  photoUrl?: string | null;
  /** Signed URL resuelta en la capa de datos para render (transitorio). */
  photoSignedUrl?: string | null;
  source: EventSource;
  transcript?: string | null;
};

export type BabyPhoto = {
  id: string;
  babyId: string;
  familyId: string;
  createdByUserId: string;
  createdAt: string;
  takenAt: string;
  /** Path del objeto en Storage. */
  photoUrl: string;
  note?: string | null;
  source: EventSource;
};

/** Foto del álbum con su signed URL y la edad del bebé en esa fecha (para agrupar). */
export type AlbumPhoto = {
  id: string;
  takenAt: string;
  note?: string | null;
  signedUrl: string | null;
  /** Semana de vida del bebé en la fecha de la foto (0 = primera semana). */
  weekIndex: number;
};

export type Reminder = {
  id: string;
  babyId: string;
  familyId: string;
  createdByUserId: string;
  createdAt: string;
  relatedEventType: "feeding" | "sleep" | "other";
  relatedEventId?: string | null;
  remindAt: string;
  status: "scheduled" | "sent" | "cancelled" | "failed";
  channel: "web_push" | "native_local" | "none";
};

export type TimelineItem = {
  id: string;
  type: "diaper" | "feeding" | "question";
  title: string;
  detail: string;
  time: string;
};

export type TodaySummary = {
  baby: Baby;
  nowLocal: string;
  counts: {
    diapers: number;
    feedings: number;
    pendingQuestions: number;
  };
  lastDiaper?: DiaperEvent;
  lastFeeding?: FeedingEvent;
  nextReminder?: Reminder;
  pendingQuestions: Question[];
  timeline: TimelineItem[];
  // Registros completos del día, para poder pre-cargar los forms de edición
  // desde el timeline (que solo guarda un resumen recortado por item).
  diapers: DiaperEvent[];
  feedings: FeedingEvent[];
};
