// Types compartilhados do pipeline V8.
// Extraídos de src/pages/AdminV8Create.tsx para reuso e clareza.

export interface AudioResult {
  index: number;
  type:
    | "section"
    | "quiz"
    | "quiz-reinforcement"
    | "quiz-explanation"
    | "playground"
    | "playground-success"
    | "playground-tryagain";
  audioUrl: string;
  durationEstimate: number;
  sizeKB: number;
}

export interface GenerateResponse {
  success: boolean;
  lessonId: string;
  results: AudioResult[];
  errors?: Array<{ index: number; type: string; error: string }>;
  stats: { totalAudios: number; totalErrors: number; totalSizeKB: number; elapsedMs: number };
}

export type AudioFailure = NonNullable<GenerateResponse["errors"]>[number];

export interface ValidationResult {
  valid: boolean;
  sectionCount: number;
  quizCount: number;
  playgroundCount: number;
  exerciseCount: number;
  warnings: string[];
  errors: string[];
}

export const AUDIO_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;
