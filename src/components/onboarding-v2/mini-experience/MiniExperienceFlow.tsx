/**
 * Tela 10 do Onboarding V2 — "Mini-experiência IA".
 * State machine interno com 7 sub-telas (Filter → 3 quizzes → 2 UAUs → 1 quiz).
 *
 * Cada sub-tela monta seu próprio screen e chama o hook useMiniExperience
 * pra persistir resposta + pontuar + avançar.
 *
 * Quando termina: chama complete() que computa score final + level e
 * dispara onComplete que avança o flow externo pra Tela 11 (Reveal).
 */
import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useMiniExperience, type DominioLevel } from "./useMiniExperience";
import { DominioBar } from "./DominioBar";
import { ComboToast } from "./ComboToast";
import { FilterInterestScreen } from "./FilterInterestScreen";
import { QuizScreen } from "./QuizScreen";
import { UauOneVisualScreen } from "./UauOneVisualScreen";
import { UauOneWritingScreen } from "./UauOneWritingScreen";
import { UauTwoSwotScreen } from "./UauTwoSwotScreen";
import { QUIZZES } from "./quizData";
import { OnboardingV2Loading } from "../OnboardingV2Loading";

interface MiniExperienceFlowProps {
  sessionId: string | null;
  onComplete: (result: { score: number; level: DominioLevel }) => void;
}

const QUIZ_BY_KEY = Object.fromEntries(QUIZZES.map((q) => [q.key, q]));

export const MiniExperienceFlow = ({
  sessionId,
  onComplete,
}: MiniExperienceFlowProps) => {
  const me = useMiniExperience(sessionId);

  // Quando o ultimo step (quiz_critique) tem resposta E o usuário clica Continuar,
  // o flow chama o orquestrador externo. Isso é feito por handleContinueFinal.

  if (!me.ready) return <OnboardingV2Loading />;

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

  // Helper p/ saber se chegou na sub-step e renderizar
  const step = me.subStep;
  const stepNumber = me.subStepIndex + 1;

  return (
    <>
      <DominioBar score={me.score} lastPointsGained={me.lastPointsGained} />
      <ComboToast streak={me.comboStreak} bonus={me.lastComboBonus} />

      <AnimatePresence mode="wait">
        {step === "filter" && (
          <FilterInterestScreen
            key="filter"
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
            stepLabel={`Mini-experiência · ${stepNumber} de ${me.totalSubSteps}`}
            difficulty="easy"
            onSubmit={(a, c) => handleQuizSubmit("input", a, c)}
            onContinue={me.next}
          />
        )}

        {step === "quiz_persona" && (
          <QuizScreen
            key="quiz_persona"
            quiz={QUIZ_BY_KEY.persona}
            stepLabel={`Mini-experiência · ${stepNumber} de ${me.totalSubSteps}`}
            difficulty="medium"
            onSubmit={(a, c) => handleQuizSubmit("persona", a, c)}
            onContinue={me.next}
          />
        )}

        {step === "quiz_context" && (
          <QuizScreen
            key="quiz_context"
            quiz={QUIZ_BY_KEY.context}
            stepLabel={`Mini-experiência · ${stepNumber} de ${me.totalSubSteps}`}
            difficulty="hard"
            onSubmit={(a, c) => handleQuizSubmit("context", a, c)}
            onContinue={me.next}
          />
        )}

        {step === "uau_one" && me.filterInterest === "writing" && (
          <UauOneWritingScreen
            key="uau_one_writing"
            stepLabel={`Mini-experiência · ${stepNumber} de ${me.totalSubSteps}`}
            onComplete={async () => {
              await me.saveUauOne({ writing: "email_rewrite" });
              me.next();
            }}
          />
        )}

        {step === "uau_one" && me.filterInterest !== "writing" && (
          <UauOneVisualScreen
            key="uau_one_visual"
            stepLabel={`Mini-experiência · ${stepNumber} de ${me.totalSubSteps}`}
            onComplete={async (data) => {
              await me.saveUauOne(data);
              me.next();
            }}
          />
        )}

        {step === "uau_two" && (
          <UauTwoSwotScreen
            key="uau_two"
            stepLabel={`Mini-experiência · ${stepNumber} de ${me.totalSubSteps}`}
            onComplete={async (data) => {
              await me.saveUauTwo(data);
              me.next();
            }}
          />
        )}

        {step === "quiz_critique" && (
          <QuizScreen
            key="quiz_critique"
            quiz={QUIZ_BY_KEY.critique}
            stepLabel={`Mini-experiência · ${stepNumber} de ${me.totalSubSteps}`}
            difficulty="hard"
            onSubmit={(a, c) => handleQuizSubmit("critique", a, c)}
            onContinue={handleFinalContinue}
          />
        )}
      </AnimatePresence>
    </>
  );
};
