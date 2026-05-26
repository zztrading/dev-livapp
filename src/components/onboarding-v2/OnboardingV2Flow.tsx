import { useCallback, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useOnboardingV2, V2QuestionId } from "@/hooks/useOnboardingV2";
import { OnboardingV2Loading } from "./OnboardingV2Loading";
import { LivIntroScreen } from "./screens/LivIntroScreen";
import { AttributionScreen } from "./screens/AttributionScreen";
import { MotivationScreen } from "./screens/MotivationScreen";
import { AiLevelScreen } from "./screens/AiLevelScreen";
import { PromiseScreen } from "./screens/PromiseScreen";
import { DailyGoalScreen } from "./screens/DailyGoalScreen";
import { NotificationPrimerScreen } from "./screens/NotificationPrimerScreen";
import { PromptKnowledgeScreen } from "./screens/PromptKnowledgeScreen";

// Placeholders pras telas que vêm nas próximas sprints
const Placeholder = ({ title }: { title: string }) => (
  <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
      Em construção
    </p>
    <h1 className="text-2xl font-bold text-foreground">{title}</h1>
  </div>
);

export const OnboardingV2Flow = () => {
  const {
    ready,
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
      {/* Progress bar global */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
          aria-label={`Etapa ${stepIndex + 1} de ${totalSteps}`}
        />
      </div>

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

          {step === "mini_experience" && <Placeholder key="mini_experience" title="Tela 10 — Sua primeira IA" />}
          {step === "reveal" && <Placeholder key="reveal" title="Tela 11 — Você fez!" />}
          {step === "signup_deferred" && <Placeholder key="signup_deferred" title="Tela 12 — Criar perfil" />}
        </AnimatePresence>
      </main>
    </div>
  );
};
