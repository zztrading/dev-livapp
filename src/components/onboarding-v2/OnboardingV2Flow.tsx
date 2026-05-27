import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useOnboardingV2, V2QuestionId } from "@/hooks/useOnboardingV2";
import type { DominioLevel } from "@/components/onboarding-v2/mini-experience/useMiniExperience";
import { OnboardingV2Loading } from "./OnboardingV2Loading";
import { LivIntroScreen } from "./screens/LivIntroScreen";
import { AttributionScreen } from "./screens/AttributionScreen";
import { MotivationScreen } from "./screens/MotivationScreen";
import { AiLevelScreen } from "./screens/AiLevelScreen";
import { PromiseScreen } from "./screens/PromiseScreen";
import { DailyGoalScreen } from "./screens/DailyGoalScreen";
import { NotificationPrimerScreen } from "./screens/NotificationPrimerScreen";
import { PromptKnowledgeScreen } from "./screens/PromptKnowledgeScreen";
import { RevealScreen } from "./screens/RevealScreen";
import { SignupDeferredScreen } from "./screens/SignupDeferredScreen";
import { MiniExperienceFlow } from "./mini-experience/MiniExperienceFlow";

export const OnboardingV2Flow = () => {
  const {
    ready,
    sessionId,
    step,
    stepIndex,
    totalSteps,
    progressPercent,
    answers,
    saveAnswer,
    trackEvent,
    goNext,
    goBack,
  } = useOnboardingV2();

  // Resultado do mini-experience (passado pra RevealScreen)
  const [miniResult, setMiniResult] = useState<{
    score: number;
    level: DominioLevel;
  } | null>(null);

  // Track view do step atual
  useEffect(() => {
    if (!ready) return;
    trackEvent(`step_view_${step}`, { step_index: stepIndex });
  }, [ready, step, stepIndex, trackEvent]);

  // Helper: salva resposta + avança
  const handleAnswer = useCallback(
    async (questionId: V2QuestionId, value: string) => {
      await saveAnswer(questionId, value);
      trackEvent("answer_saved", { question_id: questionId, value });
      goNext();
    },
    [saveAnswer, trackEvent, goNext]
  );

  if (!ready) return <OnboardingV2Loading />;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Progress bar global (oculta no mini-experience que tem barra própria) */}
      {step !== "mini_experience" && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
            aria-label={`Etapa ${stepIndex + 1} de ${totalSteps}`}
          />
        </div>
      )}

      <main role="main" className="pt-1">
        <AnimatePresence mode="wait">
          {step === "liv_intro" && (
            <LivIntroScreen key="liv_intro" onContinue={goNext} />
          )}

          {step === "attribution" && (
            <AttributionScreen
              key="attribution"
              selected={answers.attribution}
              onSelect={(v) => handleAnswer("attribution", v)}
              onBack={goBack}
            />
          )}

          {step === "motivation" && (
            <MotivationScreen
              key="motivation"
              selected={answers.motivation}
              onSelect={(v) => handleAnswer("motivation", v)}
              onBack={goBack}
            />
          )}

          {step === "ai_level" && (
            <AiLevelScreen
              key="ai_level"
              selected={answers.ai_level}
              onSelect={(v) => handleAnswer("ai_level", v)}
              onBack={goBack}
            />
          )}

          {step === "promise" && (
            <PromiseScreen
              key="promise"
              onContinue={goNext}
              onBack={goBack}
            />
          )}

          {step === "daily_goal" && (
            <DailyGoalScreen
              key="daily_goal"
              selected={answers.daily_goal}
              onSelect={(v) => handleAnswer("daily_goal", v)}
              onBack={goBack}
            />
          )}

          {step === "notification" && (
            <NotificationPrimerScreen
              key="notification"
              onResult={(result) => {
                handleAnswer("notification_opt", result);
              }}
              onBack={goBack}
            />
          )}

          {step === "prompt_knowledge" && (
            <PromptKnowledgeScreen
              key="prompt_knowledge"
              selected={answers.prompt_knowledge}
              onSelect={(v) => handleAnswer("prompt_knowledge", v)}
              onBack={goBack}
            />
          )}

          {step === "mini_experience" && (
            <MiniExperienceFlow
              key="mini_experience"
              sessionId={sessionId}
              onComplete={(result) => {
                setMiniResult(result);
                goNext();
              }}
            />
          )}

          {step === "reveal" && (
            <RevealScreen
              key="reveal"
              dominioScore={miniResult?.score}
              dominioLevel={miniResult?.level}
              sessionId={sessionId}
              onContinue={goNext}
            />
          )}
          {step === "signup_deferred" && (
            <SignupDeferredScreen key="signup_deferred" sessionId={sessionId} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
