/**
 * useMiniExperience — state machine + scoring da Tela 10 do Onboarding V2.
 *
 * Sub-telas (10 sub-passos conforme spec-onboarding-completo-v2.md):
 *   1/10. filter         — escolha visual/escrita                       +5
 *   2/10. quiz_input     — quiz "erro de input" (fácil)        acerto: +15
 *   3/10. quiz_persona   — quiz "persona" (médio)              acerto: +20
 *   4/10. quiz_context   — quiz "engenharia de contexto" (hard) acerto: +25
 *   5/10. uau_one        — UAU 1 (imagem ou email rewrite)             +10
 *   6/10. uau_two_chips  — UAU 2 Chips V5 (Prompt Builder)             +15
 *   7/10. uau_two_swot   — UAU 2 SWOT (reflexão pessoal)                +5
 *   8/10. quiz_critique  — quiz "critique loop" (hard)         acerto: +10
 *   9/10. mistake_review — retry erros (Caso A) ou skip (Caso B)        0 Domínio
 *  10/10. antecipacao    — leitura emocional silenciosa                 0
 *
 *   Total base: 5+15+20+25+10+15+5+10 = 105  (cap em 100)
 *
 *   Combo bonus quizzes (T2+T3+T4+T7):
 *     +3  (2 seguidas)
 *     +5  (3 seguidas, cumulativo +8)
 *     +10 (4 seguidas, cumulativo +18)
 *   Cap final aplicado: 100 (combo é absorvido)
 *
 *   Hearts: cada quiz errado tira 1 ❤️ (cap 4 erros, sempre ≥1 ❤️ no Desafio).
 *   Mistake Review recupera Hearts e dá Sparks (Caso A: 5⚡, Caso B: 10⚡).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubStep =
  | "filter"
  | "quiz_input"
  | "quiz_persona"
  | "quiz_context"
  | "uau_one"
  | "uau_two_chips"
  | "uau_two_swot"
  | "quiz_critique"
  | "mistake_review"
  | "antecipacao";

const SUBSTEPS: SubStep[] = [
  "filter",
  "quiz_input",
  "quiz_persona",
  "quiz_context",
  "uau_one",
  "uau_two_chips",
  "uau_two_swot",
  "quiz_critique",
  "mistake_review",
  "antecipacao",
];

const isValidSubStep = (value: string | null | undefined): value is SubStep =>
  !!value && (SUBSTEPS as readonly string[]).includes(value);

export type FilterInterest = "visual" | "writing";

// Spec v2: 4 levels (drop 'perfeito')
export type DominioLevel =
  | "iniciante"
  | "curioso"
  | "intermediario"
  | "avancado";

export interface QuizResult {
  answer: string;
  correct: boolean;
}

const POINTS = {
  filter: 5,
  quiz_input_correct: 15,
  quiz_persona_correct: 20,
  quiz_context_correct: 25,
  uau_one: 10,
  uau_two_chips: 15,
  uau_two_swot: 5,
  quiz_critique_correct: 10,
} as const;

const COMBO_BONUS = {
  2: 3,
  3: 5, // cumulativo: total +8 (3 seguidas)
  4: 10, // cumulativo: total +18 (4 seguidas)
} as const;

// Spec v2: cap real do Domínio IA é 100 (combo absorvido pelo cap)
const SCORE_CAP = 100;
const MAX_HEARTS = 5;

interface State {
  subStep: SubStep;
  filterInterest: FilterInterest | null;
  quizResults: Record<"input" | "persona" | "context" | "critique", QuizResult | null>;
  uau1Style: string | null;
  uau1Theme: string | null;
  uau1Writing: string | null;
  // Chips V5: roda só em memória (decisão de produto — não persiste no banco)
  uau2ChipsCompleted: boolean;
  // SWOT continua persistindo (cols mantidas)
  uau2Moment: string | null;
  uau2Challenge: string | null;
  uau2Goal: string | null;
  uau2PromptBuilt: string | null;
  // Mistake Review (analytics persistidos)
  mistakeReviewAttempted: boolean;
  mistakeReviewRecovered: number;
  mistakeReviewSparks: number;
  // Pontuação
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
  uau2ChipsCompleted: false,
  uau2Moment: null,
  uau2Challenge: null,
  uau2Goal: null,
  uau2PromptBuilt: null,
  mistakeReviewAttempted: false,
  mistakeReviewRecovered: 0,
  mistakeReviewSparks: 0,
  score: 0,
  comboStreak: 0,
  comboBonus: 0,
};

export interface QuizMistake {
  key: "input" | "persona" | "context" | "critique";
  answer: string;
}

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
  // Hearts derivado: 5 - quizzes errados + mistake recovered
  heartsCurrent: number;
  heartsLostInDesafio: number;
  // Timestamps pra animar shake/fade no HeartsBar
  heartsLastLostAt: number | null;
  heartsLastGainedAt: number | null;
  // Mistake Review
  mistakes: QuizMistake[]; // perguntas erradas que vão pra retry
  mistakeReviewSparks: number;
  setFilterInterest: (value: FilterInterest) => Promise<void>;
  submitQuiz: (
    quizKey: "input" | "persona" | "context" | "critique",
    answer: string,
    correct: boolean,
  ) => Promise<void>;
  saveUauOne: (data: { style?: string; theme?: string; writing?: string }) => Promise<void>;
  saveUauTwoChips: () => Promise<void>;
  saveUauTwoSwot: (data: {
    moment: string;
    challenge: string;
    goal: string;
    promptBuilt: string;
  }) => Promise<void>;
  saveMistakeReview: (data: {
    attempted: boolean;
    recovered: number;
    sparks: number;
  }) => Promise<void>;
  next: () => void;
  complete: () => Promise<{ score: number; level: DominioLevel }>;
}

function levelFromScore(score: number): DominioLevel {
  // Spec v2 linhas 643-648: faixas 30-49 / 50-69 / 70-89 / 90-100
  if (score >= 90) return "avancado";
  if (score >= 70) return "intermediario";
  if (score >= 50) return "curioso";
  return "iniciante";
}

function capScore(score: number): number {
  return Math.min(score, SCORE_CAP);
}

export function useMiniExperience(sessionId: string | null): MiniExperienceApi {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [ready, setReady] = useState(false);
  const [lastPointsGained, setLastPointsGained] = useState<number | null>(null);
  const [lastComboBonus, setLastComboBonus] = useState<number | null>(null);
  // Timestamps pra disparar animações shake (perda) / fade-in (recovery) no HeartsBar
  const [heartsLastLostAt, setHeartsLastLostAt] = useState<number | null>(null);
  const [heartsLastGainedAt, setHeartsLastGainedAt] = useState<number | null>(null);

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
        // Chips V5: não persiste, mas se chegou em uau_two_swot ou além, conta como feito
        const chipsDone = data.current_substep
          ? SUBSTEPS.indexOf(data.current_substep as SubStep) > SUBSTEPS.indexOf("uau_two_chips")
          : false;
        if (chipsDone) score += POINTS.uau_two_chips;
        if (data.uau2_prompt_built) score += POINTS.uau_two_swot;
        if (data.quiz_t7_correct === true) score += POINTS.quiz_critique_correct;

        // Cap defensivo na hidratação
        score = capScore(score);

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
          uau2ChipsCompleted: chipsDone,
          uau2Moment: data.uau2_moment ?? null,
          uau2Challenge: data.uau2_challenge ?? null,
          uau2Goal: data.uau2_goal ?? null,
          uau2PromptBuilt: data.uau2_prompt_built ?? null,
          mistakeReviewAttempted: data.mistake_review_attempted ?? false,
          mistakeReviewRecovered: data.mistake_review_recovered ?? 0,
          mistakeReviewSparks: data.mistake_review_sparks ?? 0,
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
          score: capScore(already ? prev.score : prev.score + POINTS.filter),
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
          score: capScore(prev.score + earnedBase + earnedBonus),
        };
      });

      setLastPointsGained(correct ? pointsMap[quizKey] : 0);
      setLastComboBonus(earnedBonus > 0 ? earnedBonus : null);
      // Dispara animação shake na HeartsBar quando perde vida
      if (!correct) setHeartsLastLostAt(Date.now());

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
          score: capScore(already ? prev.score : prev.score + POINTS.uau_one),
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

  // Chips V5 — NÃO persiste no banco (decisão de produto).
  // Só marca em memória que completou + soma pontos.
  const saveUauTwoChips = useCallback(async () => {
    let earned = 0;
    setState((prev) => {
      const already = prev.uau2ChipsCompleted;
      if (!already) earned = POINTS.uau_two_chips;
      return {
        ...prev,
        uau2ChipsCompleted: true,
        score: capScore(already ? prev.score : prev.score + POINTS.uau_two_chips),
      };
    });
    setLastPointsGained(earned > 0 ? earned : null);
  }, []);

  const saveUauTwoSwot = useCallback(
    async (data: {
      moment: string;
      challenge: string;
      goal: string;
      promptBuilt: string;
    }) => {
      let earned = 0;
      setState((prev) => {
        const already = !!prev.uau2PromptBuilt;
        if (!already) earned = POINTS.uau_two_swot;
        return {
          ...prev,
          uau2Moment: data.moment,
          uau2Challenge: data.challenge,
          uau2Goal: data.goal,
          uau2PromptBuilt: data.promptBuilt,
          score: capScore(already ? prev.score : prev.score + POINTS.uau_two_swot),
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

  const saveMistakeReview = useCallback(
    async (data: { attempted: boolean; recovered: number; sparks: number }) => {
      setState((prev) => ({
        ...prev,
        mistakeReviewAttempted: data.attempted,
        mistakeReviewRecovered: data.recovered,
        mistakeReviewSparks: data.sparks,
      }));
      // Dispara animação fade-in na HeartsBar quando recupera vida(s)
      if (data.recovered > 0) setHeartsLastGainedAt(Date.now());
      await persistPartial({
        mistake_review_attempted: data.attempted,
        mistake_review_recovered: data.recovered,
        mistake_review_sparks: data.sparks,
        hearts_lost_in_desafio: Math.min(
          4,
          Object.values(state.quizResults).filter((r) => r?.correct === false).length,
        ),
      });
    },
    [persistPartial, state.quizResults],
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
    const finalScore = capScore(state.score);
    const level = levelFromScore(finalScore);
    completedRef.current = { score: finalScore, level };
    await persistPartial({
      dominio_score: finalScore,
      dominio_level: level,
      completed_at: new Date().toISOString(),
    });
    return { score: finalScore, level };
  }, [state.score, persistPartial]);

  // ============================================================
  // Derivados
  // ============================================================

  const errors = Object.values(state.quizResults).filter(
    (r) => r?.correct === false,
  ).length;
  const heartsLostInDesafio = Math.min(4, errors);
  const heartsCurrent = Math.max(
    0,
    Math.min(MAX_HEARTS, MAX_HEARTS - heartsLostInDesafio + state.mistakeReviewRecovered),
  );

  // Lista de erros pra Mistake Review (perguntas que errou na ordem)
  const mistakes: QuizMistake[] = [];
  (["input", "persona", "context", "critique"] as const).forEach((key) => {
    const r = state.quizResults[key];
    if (r && r.correct === false) {
      mistakes.push({ key, answer: r.answer });
    }
  });

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
    heartsCurrent,
    heartsLostInDesafio,
    heartsLastLostAt,
    heartsLastGainedAt,
    mistakes,
    mistakeReviewSparks: state.mistakeReviewSparks,
    setFilterInterest,
    submitQuiz,
    saveUauOne,
    saveUauTwoChips,
    saveUauTwoSwot,
    saveMistakeReview,
    next,
    complete,
  };
}
