/**
 * useMiniExperience — state machine + scoring da Tela 10 do quiz.
 *
 * Telas internas (7 sub-passos):
 *   1. filter      — escolha visual/escrita
 *   2. quiz_input   — quiz "erro de input" (fácil)
 *   3. quiz_persona — quiz "persona" (médio)
 *   4. quiz_context — quiz "engenharia de contexto" (hard)
 *   5. uau_one      — UAU 1 (imagem ou email rewrite, depende do filtro)
 *   6. uau_two      — UAU 2 (Prompt Builder SWOT universal)
 *   7. quiz_critique — quiz "critique loop" (hard)
 *
 * Pontuação Domínio IA:
 *   Tela 1: +5  (escolha pessoal)
 *   Tela 2: +10 acerto
 *   Tela 3: +15 acerto
 *   Tela 4: +20 acerto
 *   Tela 5: +15 (interativo, sempre)
 *   Tela 6: +20 (interativo, sempre)
 *   Tela 7: +15 acerto
 *   Total base: 100
 *   Combo bonus: +3 (2 seguidas) / +5 (3 seguidas, cumulativo +8) /
 *                +10 (4 seguidas, cumulativo +18) → cap 130
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubStep =
  | "filter"
  | "quiz_input"
  | "quiz_persona"
  | "quiz_context"
  | "uau_one"
  | "uau_two"
  | "quiz_critique";

const SUBSTEPS: SubStep[] = [
  "filter",
  "quiz_input",
  "quiz_persona",
  "quiz_context",
  "uau_one",
  "uau_two",
  "quiz_critique",
];

const isValidSubStep = (value: string | null | undefined): value is SubStep =>
  !!value && (SUBSTEPS as readonly string[]).includes(value);

export type FilterInterest = "visual" | "writing";

export type DominioLevel =
  | "iniciante"
  | "curioso"
  | "intermediario"
  | "avancado"
  | "perfeito";

export interface QuizResult {
  answer: string;
  correct: boolean;
}

const POINTS = {
  filter: 5,
  quiz_input_correct: 10,
  quiz_persona_correct: 15,
  quiz_context_correct: 20,
  uau_one: 15,
  uau_two: 20,
  quiz_critique_correct: 15,
} as const;

const COMBO_BONUS = {
  2: 3,
  3: 5, // cumulativo: total +8 (3 seguidas)
  4: 10, // cumulativo: total +18 (4 seguidas)
} as const;

interface State {
  subStep: SubStep;
  filterInterest: FilterInterest | null;
  quizResults: Record<"input" | "persona" | "context" | "critique", QuizResult | null>;
  uau1Style: string | null;
  uau1Theme: string | null;
  uau1Writing: string | null;
  uau2Moment: string | null;
  uau2Challenge: string | null;
  uau2Goal: string | null;
  uau2PromptBuilt: string | null;
  score: number;
  comboStreak: number;
  comboBonus: number;
}

const INITIAL_STATE: State = {
  subStep: "filter",
  filterInterest: null,
  quizResults: { input: null, persona: null, context: null, critique: null },
  uau1Style: null,
  uau1Theme: null,
  uau1Writing: null,
  uau2Moment: null,
  uau2Challenge: null,
  uau2Goal: null,
  uau2PromptBuilt: null,
  score: 0,
  comboStreak: 0,
  comboBonus: 0,
};

export interface MiniExperienceApi {
  ready: boolean;
  subStep: SubStep;
  subStepIndex: number;
  totalSubSteps: number;
  score: number;
  comboStreak: number;
  filterInterest: FilterInterest | null;
  lastPointsGained: number | null;
  lastComboBonus: number | null;
  setFilterInterest: (value: FilterInterest) => Promise<void>;
  submitQuiz: (
    quizKey: "input" | "persona" | "context" | "critique",
    answer: string,
    correct: boolean,
  ) => Promise<void>;
  saveUauOne: (data: { style?: string; theme?: string; writing?: string }) => Promise<void>;
  saveUauTwo: (data: {
    moment: string;
    challenge: string;
    goal: string;
    promptBuilt: string;
  }) => Promise<void>;
  next: () => void;
  complete: () => Promise<{ score: number; level: DominioLevel }>;
}

function levelFromScore(score: number): DominioLevel {
  if (score >= 100) return "perfeito";
  if (score >= 95) return "avancado";
  if (score >= 80) return "intermediario";
  if (score >= 60) return "curioso";
  return "iniciante";
}

export function useMiniExperience(sessionId: string | null): MiniExperienceApi {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [ready, setReady] = useState(false);
  const [lastPointsGained, setLastPointsGained] = useState<number | null>(null);
  const [lastComboBonus, setLastComboBonus] = useState<number | null>(null);

  // Promise singleton do INSERT inicial — anti-TOCTOU
  const ensurePromiseRef = useRef<Promise<unknown> | null>(null);

  const ensureRow = useCallback(async () => {
    if (!sessionId) return;
    if (!ensurePromiseRef.current) {
      ensurePromiseRef.current = Promise.resolve(
        supabase
          .from("onboarding_v2_mini_experience")
          .upsert(
            { session_id: sessionId, current_substep: "filter" },
            { onConflict: "session_id", ignoreDuplicates: true },
          ),
      );
    }
    await ensurePromiseRef.current;
  }, [sessionId]);

  // Hidratação inicial
  useEffect(() => {
    if (!sessionId) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("onboarding_v2_mini_experience")
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        let score = data.combo_bonus_accumulated ?? 0;
        if (data.filter_interest) score += POINTS.filter;
        if (data.quiz_t2_correct === true) score += POINTS.quiz_input_correct;
        if (data.quiz_t3_correct === true) score += POINTS.quiz_persona_correct;
        if (data.quiz_t4_correct === true) score += POINTS.quiz_context_correct;
        if (data.uau1_style || data.uau1_writing) score += POINTS.uau_one;
        if (data.uau2_prompt_built) score += POINTS.uau_two;
        if (data.quiz_t7_correct === true) score += POINTS.quiz_critique_correct;

        // Recalcula streak na ordem dos quizzes
        const sequence: (boolean | null)[] = [
          data.quiz_t2_correct ?? null,
          data.quiz_t3_correct ?? null,
          data.quiz_t4_correct ?? null,
          data.quiz_t7_correct ?? null,
        ];
        let streak = 0;
        for (const r of sequence) {
          if (r === true) streak += 1;
          else if (r === false) streak = 0;
          else break;
        }

        setState({
          subStep: isValidSubStep(data.current_substep) ? data.current_substep : "filter",
          filterInterest: (data.filter_interest as FilterInterest | null) ?? null,
          quizResults: {
            input:
              data.quiz_t2_correct === true || data.quiz_t2_correct === false
                ? { answer: data.quiz_t2_answer ?? "", correct: data.quiz_t2_correct }
                : null,
            persona:
              data.quiz_t3_correct === true || data.quiz_t3_correct === false
                ? { answer: data.quiz_t3_answer ?? "", correct: data.quiz_t3_correct }
                : null,
            context:
              data.quiz_t4_correct === true || data.quiz_t4_correct === false
                ? { answer: data.quiz_t4_answer ?? "", correct: data.quiz_t4_correct }
                : null,
            critique:
              data.quiz_t7_correct === true || data.quiz_t7_correct === false
                ? { answer: data.quiz_t7_answer ?? "", correct: data.quiz_t7_correct }
                : null,
          },
          uau1Style: data.uau1_style ?? null,
          uau1Theme: data.uau1_theme ?? null,
          uau1Writing: data.uau1_writing ?? null,
          uau2Moment: data.uau2_moment ?? null,
          uau2Challenge: data.uau2_challenge ?? null,
          uau2Goal: data.uau2_goal ?? null,
          uau2PromptBuilt: data.uau2_prompt_built ?? null,
          score,
          comboStreak: streak,
          comboBonus: data.combo_bonus_accumulated ?? 0,
        });
        ensurePromiseRef.current = Promise.resolve();
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Persiste current_substep no DB (sem side-effect dentro de setState)
  useEffect(() => {
    if (!ready || !sessionId) return;
    void (async () => {
      await ensureRow();
      await supabase
        .from("onboarding_v2_mini_experience")
        .update({ current_substep: state.subStep })
        .eq("session_id", sessionId);
    })();
  }, [ready, sessionId, state.subStep, ensureRow]);

  // Persiste combo_bonus quando muda
  useEffect(() => {
    if (!ready || !sessionId || state.comboBonus === 0) return;
    void (async () => {
      await ensureRow();
      await supabase
        .from("onboarding_v2_mini_experience")
        .update({ combo_bonus_accumulated: state.comboBonus })
        .eq("session_id", sessionId);
    })();
  }, [ready, sessionId, state.comboBonus, ensureRow]);

  const persistPartial = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!sessionId) return;
      await ensureRow();
      await supabase
        .from("onboarding_v2_mini_experience")
        .update(patch as never)
        .eq("session_id", sessionId);
    },
    [sessionId, ensureRow],
  );

  const setFilterInterest = useCallback(
    async (value: FilterInterest) => {
      let earnedPoints = 0;
      setState((prev) => {
        const already = !!prev.filterInterest;
        if (!already) earnedPoints = POINTS.filter;
        return {
          ...prev,
          filterInterest: value,
          score: already ? prev.score : prev.score + POINTS.filter,
        };
      });
      setLastPointsGained(earnedPoints > 0 ? earnedPoints : null);
      await persistPartial({ filter_interest: value });
    },
    [persistPartial],
  );

  const submitQuiz = useCallback(
    async (
      quizKey: "input" | "persona" | "context" | "critique",
      answer: string,
      correct: boolean,
    ) => {
      const pointsMap = {
        input: POINTS.quiz_input_correct,
        persona: POINTS.quiz_persona_correct,
        context: POINTS.quiz_context_correct,
        critique: POINTS.quiz_critique_correct,
      };
      const dbColMap = {
        input: { answer: "quiz_t2_answer", correct: "quiz_t2_correct" },
        persona: { answer: "quiz_t3_answer", correct: "quiz_t3_correct" },
        context: { answer: "quiz_t4_answer", correct: "quiz_t4_correct" },
        critique: { answer: "quiz_t7_answer", correct: "quiz_t7_correct" },
      };

      let earnedBase = 0;
      let earnedBonus = 0;

      setState((prev) => {
        if (prev.quizResults[quizKey] !== null) return prev;

        earnedBase = correct ? pointsMap[quizKey] : 0;
        const newStreak = correct ? prev.comboStreak + 1 : 0;
        if (correct && newStreak >= 2 && newStreak <= 4) {
          earnedBonus = COMBO_BONUS[newStreak as 2 | 3 | 4] ?? 0;
        }

        return {
          ...prev,
          quizResults: { ...prev.quizResults, [quizKey]: { answer, correct } },
          comboStreak: newStreak,
          comboBonus: prev.comboBonus + earnedBonus,
          score: prev.score + earnedBase + earnedBonus,
        };
      });

      setLastPointsGained(correct ? pointsMap[quizKey] : 0);
      setLastComboBonus(earnedBonus > 0 ? earnedBonus : null);

      await persistPartial({
        [dbColMap[quizKey].answer]: answer,
        [dbColMap[quizKey].correct]: correct,
      });
    },
    [persistPartial],
  );

  const saveUauOne = useCallback(
    async (data: { style?: string; theme?: string; writing?: string }) => {
      let earned = 0;
      setState((prev) => {
        const already = !!(prev.uau1Style || prev.uau1Writing);
        if (!already) earned = POINTS.uau_one;
        return {
          ...prev,
          uau1Style: data.style ?? prev.uau1Style,
          uau1Theme: data.theme ?? prev.uau1Theme,
          uau1Writing: data.writing ?? prev.uau1Writing,
          score: already ? prev.score : prev.score + POINTS.uau_one,
        };
      });
      setLastPointsGained(earned > 0 ? earned : null);
      await persistPartial({
        uau1_style: data.style ?? null,
        uau1_theme: data.theme ?? null,
        uau1_writing: data.writing ?? null,
      });
    },
    [persistPartial],
  );

  const saveUauTwo = useCallback(
    async (data: {
      moment: string;
      challenge: string;
      goal: string;
      promptBuilt: string;
    }) => {
      let earned = 0;
      setState((prev) => {
        const already = !!prev.uau2PromptBuilt;
        if (!already) earned = POINTS.uau_two;
        return {
          ...prev,
          uau2Moment: data.moment,
          uau2Challenge: data.challenge,
          uau2Goal: data.goal,
          uau2PromptBuilt: data.promptBuilt,
          score: already ? prev.score : prev.score + POINTS.uau_two,
        };
      });
      setLastPointsGained(earned > 0 ? earned : null);
      await persistPartial({
        uau2_moment: data.moment,
        uau2_challenge: data.challenge,
        uau2_goal: data.goal,
        uau2_prompt_built: data.promptBuilt,
      });
    },
    [persistPartial],
  );

  // Avança sub-step. Side-effect (persist) está em useEffect separado.
  const next = useCallback(() => {
    setState((prev) => {
      const idx = SUBSTEPS.indexOf(prev.subStep);
      const nextStep = SUBSTEPS[Math.min(idx + 1, SUBSTEPS.length - 1)];
      return { ...prev, subStep: nextStep };
    });
    setLastPointsGained(null);
    setLastComboBonus(null);
  }, []);

  // Idempotente: 2 chamadas retornam mesmo resultado, 1 só write
  const completedRef = useRef<{ score: number; level: DominioLevel } | null>(null);
  const complete = useCallback(async (): Promise<{ score: number; level: DominioLevel }> => {
    if (completedRef.current) return completedRef.current;
    const finalScore = Math.min(state.score, 130);
    const level = levelFromScore(finalScore);
    completedRef.current = { score: finalScore, level };
    await persistPartial({
      dominio_score: finalScore,
      dominio_level: level,
      completed_at: new Date().toISOString(),
    });
    return { score: finalScore, level };
  }, [state.score, persistPartial]);

  return {
    ready,
    subStep: state.subStep,
    subStepIndex: SUBSTEPS.indexOf(state.subStep),
    totalSubSteps: SUBSTEPS.length,
    score: state.score,
    comboStreak: state.comboStreak,
    filterInterest: state.filterInterest,
    lastPointsGained,
    lastComboBonus,
    setFilterInterest,
    submitQuiz,
    saveUauOne,
    saveUauTwo,
    next,
    complete,
  };
}
