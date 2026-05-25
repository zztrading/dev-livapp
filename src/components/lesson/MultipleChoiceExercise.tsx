import { useState, useRef, useEffect } from "react";
// Card removido propositalmente — Card global aplica gradiente/textura inline que destoa do Premium Light
import { Button } from "@/components/ui/button";
import { useV7SoundEffects } from "@/components/lessons/v7/cinematic/useV7SoundEffects";
import { ensureElementVisible } from "@/components/lessons/v8/v8ScrollUtils";
import { ExerciseHeader } from "@/components/lessons/_shared/ExerciseHeader";
import { ChoiceCard, type ChoiceState } from "@/components/lessons/_shared/ChoiceCard";

interface MultipleChoiceExerciseProps {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  onComplete: (isCorrect: boolean) => void;
}

export const MultipleChoiceExercise = ({
  question,
  options,
  correctAnswer,
  explanation,
  onComplete,
}: MultipleChoiceExerciseProps) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const { playSound } = useV7SoundEffects(0.6, true);
  const feedbackRef = useRef<HTMLDivElement>(null);

  // Scroll to make the global "Continuar Aula" button visible after submit
  useEffect(() => {
    if (isSubmitted && feedbackRef.current) {
      const timer = setTimeout(() => {
        ensureElementVisible(feedbackRef.current, { safeBottom: 160 });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isSubmitted]);

  const handleSubmit = () => {
    setIsSubmitted(true);
    const correct = selectedAnswer === correctAnswer;
    setIsCorrect(correct);
    
    if (correct) {
      playSound('quiz-correct');
    } else {
      playSound('quiz-wrong');
    }
    // Delegate navigation to parent (V8InlineExercise handles Flow A/B buttons)
    onComplete(correct);
  };

  const handleTryAgain = () => {
    setSelectedAnswer("");
    setIsSubmitted(false);
    setIsCorrect(false);
  };

  // Limit to 3 options for cleaner UI
  const displayOptions = options.slice(0, 3);
  // Ensure correctAnswer is in displayOptions
  if (!displayOptions.includes(correctAnswer) && options.includes(correctAnswer)) {
    displayOptions[displayOptions.length - 1] = correctAnswer;
  }

  return (
    <div
      className={`p-5 sm:p-7 space-y-6 border border-border/50 rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-card transition-all duration-300 ${
        isFadingOut ? "animate-fade-out" : "animate-fade-in"
      }`}
    >
      <ExerciseHeader question={question} />

      <div className="space-y-2.5">
        {displayOptions.map((option, index) => {
          const isThisCorrect = option === correctAnswer;
          const isSelected = selectedAnswer === option;

          let state: ChoiceState = "idle";
          if (isSubmitted && isThisCorrect && isSelected) state = "correct";
          else if (isSubmitted && isThisCorrect) state = "reveal-correct";
          else if (isSubmitted && isSelected) state = "wrong";
          else if (isSelected) state = "selected";

          return (
            <ChoiceCard
              key={`option-${index}`}
              index={index}
              title={option}
              state={state}
              disabled={isSubmitted}
              onClick={() => !isSubmitted && setSelectedAnswer(option)}
            />
          );
        })}
      </div>

      <div ref={feedbackRef}>
        {!isSubmitted && (
          <Button
            onClick={handleSubmit}
            disabled={!selectedAnswer}
            className="w-full h-11 sm:h-12 text-sm sm:text-base rounded-2xl"
            size="lg"
          >
            Confirmar resposta
          </Button>
        )}
      </div>
    </div>
  );
};