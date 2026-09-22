export type ContentOsKind =
  "video" | "education" | "article" | "tip" | "technique" | "nutrition" | "recovery" | "motivation";

export type Expert = {
  id: string;
  name: string;
  bio: string;
  specialty: string;
  verified: boolean;
  active: boolean;
  photoMediaId?: string;
  social?: Record<string, string>;
};

export type ContentCollection = {
  id: string;
  title: string;
  kind: string;
  published: boolean;
  sortOrder: number;
  expertId?: string;
  coverMediaId?: string;
};

export type ContentProgram = {
  id: string;
  title: string;
  description: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  expertIds: string[];
  published: boolean;
  goal?: string;
  level?: string;
  coverMediaId?: string;
  publishAt?: string;
};

/** Authoritative training prescription inside program_sessions.training_json */
export type ProgramTrainingExercise = {
  exerciseId: string;
  sets: number;
  reps: string;
  restSec?: number;
  loadHint?: number;
  unit?: "kg" | "corpo" | "min";
};

export type ProgramTrainingDay = {
  title?: string;
  focus?: string;
  estimatedMin?: number;
  exercises: ProgramTrainingExercise[];
};

export type ProgramSession = {
  id: string;
  programId: string;
  week: number;
  day: number;
  contentItemId?: string;
  /** Authoritative workout when parseProgramTraining succeeds; else editorial theme bag. */
  training?: Record<string, unknown>;
  nutrition?: Record<string, unknown>;
  recovery?: Record<string, unknown>;
};

export type ContentProgressFlag = {
  contentId: string;
  dismissed?: boolean;
  saved?: boolean;
  completionPercent?: number;
};

export type ContentHit = {
  contentId: string;
  kind: ContentOsKind;
  score: number;
  reason: string;
};
