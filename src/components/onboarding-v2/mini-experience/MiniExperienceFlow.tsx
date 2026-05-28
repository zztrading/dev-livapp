/**
 * Tela 10 do Onboarding V2 — "Mini-experiência IA" / Desafio.
 *
 * State machine interno com 10 sub-telas (spec onboarding v2):
 *   1/10 filter         · 2/10 quiz_input   · 3/10 quiz_persona · 4/10 quiz_context
 *   5/10 uau_one        · 6/10 uau_two_chips · 7/10 uau_two_swot · 8/10 quiz_critique
 *   9/10 mistake_review · 10/10 antecipacao
 *
 * Header fixo durante todo o Desafio:
 *   [Brain] Domínio IA: XX/100 [+X] [❤️❤️❤️❤️❤️]
 *
 * Quando termina (após Antecipação): chama complete() que computa score final
 * + level e dispara onComplete que avança o flow externo pra Tela 11 (Reveal).
 */
import { useState } from "react";
import { useMiniExperience, type DominioLevel } from "./useMiniExperience";
import { DominioBar } from "./DominioBar";
import { ComboToast } from "./ComboToast";
import { FilterInterestScreen } from "./FilterInterestScreen";
import { QuizScreen } from "./QuizScreen";
import { UauOneVisualScreen } from "./UauOneVisualScreen";
import { UauOneWritingScreen } from "./UauOneWritingScreen";
import { UauTwoChipsV5Screen } from "./UauTwoChipsV5Screen";
import { UauTwoSwotScreen } from "./UauTwoSwotScreen";
import { MistakeReviewScreen } from "./MistakeReviewScreen";
import { AntecipacaoScreen } from "./AntecipacaoScreen";
import { MiniExperienceIntro } from "./MiniExperienceIntro";
import { QUIZZES } from "./quizData";
import { OnboardingV2Loading } from "../OnboardingV2Loading";
import { AnimatePresence } from "framer-motion";

interface MiniExperienceFlowProps {
  sessionId: string | null;
  onComplete: (result: { score: number; level: DominioLevel }) => void;
}

const QUIZ_BY_KEY = Object.fromEntries(QUIZZES.map((q) => [q.key, q]));

const INTRO_STORAGE_KEY = (sid: string | null) => `mini_intro_dismissed_${sid ?? "anon"}`;

export const MiniExperienceFlow = ({
  sessionId,
  onComplete,
}: MiniExperienceFlowProps) => {
  const me = useMiniExperience(sessionId);

  // Mostra intro apenas na entrada inicial (não após refresh dentro do desafio).
  // Persiste em sessionStorage por sessionId pra sobreviver F5 mas zerar em sessão nova.
  const [introDismissed, setIntroDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return sessionStorage.getItem(INTRO_STORAGE_KEY(sessionId)) === "true";
    } catch {
      return false;
    }
  });

  const dismissIntro = () => {
    try {
      sessionStorage.setItem(INTRO_STORAGE_KEY(sessionId), "true");
    } catch {
      /* sessionStorage indisponível — segue mesmo assim */
    }
    setIntroDismissed(true);
  };

  if (!me.ready) return <OnboardingV2Loading />;

  // Tela de transição: só mostra na entrada inicial (filter ainda não respondido)
  if (!introDismissed && me.subStep === "filter" && me.filterInterest === null) {
    return <MiniExperienceIntro onContinue={dismissIntro} />;
  }

  const handleQuizSubmit = async (
    key: "input" | "persona" | "context" | "critique",
    answer: string,
    correct: boolean,
  ) => {
    await me.submitQuiz(key, answer, correct);
  };

  const handleFinalContinue = async () => {
    const result = await me.complete();
    onComplete(result);
  };

  const step = me.subStep;
  const stepNumber = me.subStepIndex + 1;
  const stepLabel = `Mini-experiência · ${stepNumber} de ${me.totalSubSteps}`;
  const isAntecipacao = step === "antecipacao";

  return (
    <>
      <DominioBar
        score={me.score}
        lastPointsGained={me.lastPointsGained}
        silent={isAntecipacao}
        hearts={me.heartsCurrent}
        heartsLastLostAt={me.heartsLastLostAt}
        heartsLastGainedAt={me.heartsLastGainedAt}
      />
      <ComboToast streak={me.comboStreak} bonus={me.lastComboBonus} />

      <AnimatePresence mode="wait">
        {step === "filter" && (
          <FilterInterestScreen
            key="filter"
            stepLabel={stepLabel}
            onSelect={async (value) => {
              await me.setFilterInterest(value);
              setTimeout(me.next, 500);
            }}
          />
        )}

        {step === "quiz_input" && (
          <QuizScreen
            key="quiz_input"
            quiz={QUIZ_BY_KEY.input}
            stepLabel={stepLabel}
            difficulty="easy"
            onSubmit={(a, c) => handleQuizSubmit("input", a, c)}
            onContinue={me.next}
          />
        )}

        {step === "quiz_persona" && (
          <QuizScreen
            key="quiz_persona"
            quiz={QUIZ_BY_KEY.persona}
            stepLabel={stepLabel}
            difficulty="medium"
            onSubmit={(a, c) => handleQuizSubmit("persona", a, c)}
            onContinue={me.next}
          />
        )}

        {step === "quiz_context" && (
          <QuizScreen
            key="quiz_context"
            quiz={QUIZ_BY_KEY.context}
            stepLabel={stepLabel}
            difficulty="hard"
            onSubmit={(a, c) => handleQuizSubmit("context", a, c)}
            onContinue={me.next}
          />
        )}

        {step === "uau_one" && me.filterInterest === "writing" && (
          <UauOneWritingScreen
            key="uau_one_writing"
            stepLabel={stepLabel}
            onComplete={async () => {
              await me.saveUauOne({ writing: "email_rewrite" });
              me.next();
            }}
          />
        )}

        {step === "uau_one" && me.filterInterest !== "writing" && (
          <UauOneVisualScreen
            key="uau_one_visual"
            stepLabel={stepLabel}
            onComplete={async (data) => {
              await me.saveUauOne(data);
              me.next();
            }}
          />
        )}

        {step === "uau_two_chips" && (
          <UauTwoChipsV5Screen
            key="uau_two_chips"
            stepLabel={stepLabel}
            onComplete={async () => {
              await me.saveUauTwoChips();
              me.next();
            }}
          />
        )}

        {step === "uau_two_swot" && (
          <UauTwoSwotScreen
            key="uau_two_swot"
            stepLabel={stepLabel}
            onComplete={async (data) => {
              await me.saveUauTwoSwot(data);
              me.next();
            }}
          />
        )}

        {step === "quiz_critique" && (
          <QuizScreen
            key="quiz_critique"
            quiz={QUIZ_BY_KEY.critique}
            stepLabel={stepLabel}
            difficulty="hard"
            onSubmit={(a, c) => handleQuizSubmit("critique", a, c)}
            onContinue={me.next}
          />
        )}

        {step === "mistake_review" && (
          <MistakeReviewScreen
            key="mistake_review"
            stepLabel={stepLabel}
            mistakes={me.mistakes}
            onComplete={async (data) => {
              await me.saveMistakeReview(data);
              me.next();
            }}
          />
        )}

        {step === "antecipacao" && (
          <AntecipacaoScreen
            key="antecipacao"
            stepLabel={stepLabel}
            onContinue={handleFinalContinue}
          />
        )}
      </AnimatePresence>
    </>
  );
};
