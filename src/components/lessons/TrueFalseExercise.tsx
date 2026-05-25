import { useState } from 'react';
import { Button } from '@/components/ui/button';
// Card global removido — usa div puro
import { Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExerciseErrorCard } from './ExerciseErrorCard';
import { useV7SoundEffects } from './v7/cinematic/useV7SoundEffects';
import confetti from 'canvas-confetti';

interface Statement {
  id: string;
  text: string;
  correct: boolean;
  explanation: string;
}

interface TrueFalseExerciseProps {
  title: string;
  instruction: string;
  statements: Statement[];
  feedback: {
    perfect: string;
    good: string;
    needsReview: string;
  };
  onComplete: (score: number) => void;
}

export function TrueFalseExercise({
  title,
  instruction,
  statements,
  feedback,
  onComplete
}: TrueFalseExerciseProps) {
  const statement = statements?.[0];
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState<boolean | null>(null);
  const { playSound } = useV7SoundEffects(0.6, true);

  if (!statement) {
    return (
      <ExerciseErrorCard 
        title="⚠️ Exercício Sem Afirmações"
        message="Este exercício não possui afirmações configuradas."
        details="Campo 'statements' está ausente ou vazio."
      />
    );
  }

  const normalizedCorrect = typeof statement.correct === 'string' 
    ? statement.correct === 'true' 
    : Boolean(statement.correct);
  const isCorrect = userAnswer === normalizedCorrect;

  const handleAnswer = (answer: boolean) => {
    if (answered) return;
    setUserAnswer(answer);
    setAnswered(true);

    const correct = answer === normalizedCorrect;
    if (correct) {
      playSound('quiz-correct');
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.5 } });
    } else {
      playSound('quiz-wrong');
    }
    // Report immediately — parent owns navigation buttons
    onComplete(correct ? 100 : 0);
  };

  return (
    <motion.div
      className="space-y-5 max-w-3xl mx-auto p-4 sm:p-6"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className={`p-5 sm:p-7 space-y-6 rounded-3xl border shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 ${
          answered
            ? isCorrect
              ? "border-success/40 bg-success/[0.04]"
              : "border-destructive/40 bg-destructive/[0.04]"
            : "border-border/50 bg-card"
        }`}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
            <span>{title || "Verdadeiro ou falso"}</span>
          </div>
          <p className="text-[17px] sm:text-xl font-semibold leading-snug tracking-tight text-foreground">
            {instruction}
          </p>
        </div>

        <div className="px-4 py-3.5 bg-muted/40 rounded-2xl border border-border/60 flex items-start gap-3">
          <p className="flex-1 text-[14px] sm:text-[15px] font-medium text-foreground leading-relaxed">
            {statement.text}
          </p>
          {answered && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
              className="flex-shrink-0"
            >
              {isCorrect ? (
                <div className="rounded-full bg-success/15 p-1.5">
                  <Check className="h-4 w-4 text-success" strokeWidth={3} />
                </div>
              ) : (
                <div className="rounded-full bg-destructive/15 p-1.5">
                  <X className="h-4 w-4 text-destructive" strokeWidth={3} />
                </div>
              )}
            </motion.div>
          )}
        </div>

        {!answered && (
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => handleAnswer(true)}
              className="h-12 rounded-2xl bg-success text-success-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition"
            >
              <Check className="h-4 w-4" strokeWidth={3} />
              Verdadeiro
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => handleAnswer(false)}
              className="h-12 rounded-2xl bg-destructive text-destructive-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition"
            >
              <X className="h-4 w-4" strokeWidth={3} />
              Falso
            </motion.button>
          </div>
        )}

        <AnimatePresence>
          {answered && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                {statement.explanation}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
