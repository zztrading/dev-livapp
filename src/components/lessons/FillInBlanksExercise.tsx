import { Button } from '@/components/ui/button';
import { Check, X, Lightbulb } from 'lucide-react';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ExerciseErrorCard } from './ExerciseErrorCard';
import { splitByPlaceholder } from '@/lib/exerciseConstants';
import { useV7SoundEffects } from './v7/cinematic/useV7SoundEffects';
import { ExerciseHeader } from './_shared/ExerciseHeader';

const GENERIC_DISTRACTORS = [
  'reativo', 'passivo', 'manual', 'lento', 'isolado',
  'consultivo', 'estratégico', 'preditivo', 'automático',
  'simples', 'pontual', 'genérico', 'individual', 'fragmentado',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildNuggets(correct: string, providedOptions: string[] | undefined, pool: string[]): string[] {
  const norm = (s: string) => s.toLowerCase().trim();
  const correctNorm = norm(correct);

  if (providedOptions && providedOptions.length >= 3) {
    const hasCorrect = providedOptions.some((o) => norm(o) === correctNorm);
    const base = hasCorrect ? providedOptions.slice(0, 3) : [correct, ...providedOptions.slice(0, 2)];
    return shuffle(base);
  }

  const distractors: string[] = providedOptions
    ? providedOptions.filter((o) => norm(o) !== correctNorm)
    : [];

  const candidates = [...pool, ...GENERIC_DISTRACTORS]
    .filter((c) => c && norm(c) !== correctNorm && !distractors.some((d) => norm(d) === norm(c)));

  while (distractors.length < 2 && candidates.length > 0) {
    const idx = Math.floor(Math.random() * candidates.length);
    distractors.push(candidates.splice(idx, 1)[0]);
  }
  while (distractors.length < 2) {
    distractors.push(distractors.length === 0 ? 'outro' : 'nenhum');
  }
  return shuffle([correct, ...distractors.slice(0, 2)]);
}

interface Sentence {
  id: string;
  text: string;
  correctAnswers: string[];
  hints?: string[];
  hint?: string;
  explanation?: string;
  options?: string[];
}

interface FillInBlanksExerciseProps {
  title: string;
  instruction: string;
  sentences: Sentence[];
  feedback: { allCorrect: string; someCorrect: string; needsReview: string };
  onComplete: (score: number) => void;
}

export function FillInBlanksExercise({
  title,
  instruction,
  sentences,
  feedback,
  onComplete,
}: FillInBlanksExerciseProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const { playSound } = useV7SoundEffects(0.6, true);

  const distractorPool = useMemo(() => {
    if (!sentences) return [] as string[];
    return sentences.flatMap((s) => s.correctAnswers || []);
  }, [sentences]);

  const nuggetsBySentence = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!sentences) return map;
    sentences.forEach((s) => {
      const correct = s.correctAnswers?.[0] ?? '';
      map[s.id] = buildNuggets(correct, s.options, distractorPool);
    });
    return map;
  }, [sentences, distractorPool]);

  if (!sentences || sentences.length === 0) {
    return (
      <ExerciseErrorCard
        title="Exercício sem sentenças"
        message="Este exercício não possui sentenças configuradas."
        details="Campo 'sentences' está ausente ou vazio."
      />
    );
  }

  const handleAnswerChange = (sentenceId: string, value: string) => {
    setAnswers({ ...answers, [sentenceId]: value });
  };

  const handleSubmit = () => {
    const newResults: Record<string, boolean> = {};
    sentences.forEach((sentence) => {
      const userAnswer = answers[sentence.id]?.toLowerCase().trim() || '';
      const isCorrect = sentence.correctAnswers.some(
        (correct) => correct.toLowerCase() === userAnswer,
      );
      newResults[sentence.id] = isCorrect;
    });
    setResults(newResults);
    setSubmitted(true);

    const correctCount = Object.values(newResults).filter(Boolean).length;
    const score = Math.round((correctCount / sentences.length) * 100);
    const isPerfect = correctCount === sentences.length;

    if (isPerfect) {
      playSound('level-up');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366F1', '#8B5CF6', '#34D399'],
      });
    } else if (score >= 50) {
      playSound('streak-bonus');
    } else {
      playSound('error');
    }
    onComplete(score);
  };

  const correctCount = Object.values(results).filter(Boolean).length;
  const allAnswered = sentences.every((s) => answers[s.id]?.trim());

  const getFeedbackMessage = () => {
    if (correctCount === sentences.length) return feedback.allCorrect;
    if (correctCount > 0) return feedback.someCorrect.replace('{count}', String(correctCount));
    return feedback.needsReview;
  };

  return (
    <motion.div
      className="space-y-6 max-w-3xl mx-auto"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="p-5 sm:p-7 space-y-6 border border-border/50 rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-card">
        <ExerciseHeader question={title} instruction={instruction} />

        <div className="space-y-4">
          {sentences.map((sentence, index) => {
            const parts = splitByPlaceholder(sentence.text);
            const isCorrect = results[sentence.id];

            return (
              <motion.div
                key={sentence.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className={`p-4 sm:p-5 space-y-4 rounded-2xl border transition-all duration-300 ${
                  submitted
                    ? isCorrect
                      ? 'border-success/40 bg-success/[0.04]'
                      : 'border-destructive/40 bg-destructive/[0.04]'
                    : 'border-border/60 bg-muted/20'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <span>Questão {index + 1}</span>
                </div>

                {!submitted && (sentence.hints || sentence.hint) && (
                  <div className="flex items-start gap-2 px-3.5 py-2.5 bg-card rounded-xl border border-border/60">
                    <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={2.25} />
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      <span className="font-semibold text-foreground">Dica: </span>
                      {sentence.hints ? sentence.hints.join(' • ') : sentence.hint}
                    </p>
                  </div>
                )}

                <div className="text-[15px] sm:text-base leading-relaxed">
                  <div className="flex flex-wrap items-center gap-2">
                    {parts[0] && <span className="text-foreground">{parts[0]}</span>}
                    <span
                      className={`inline-flex items-center justify-center min-w-[110px] px-3.5 h-9 rounded-full font-semibold text-[13px] border-2 transition-all ${
                        submitted
                          ? isCorrect
                            ? 'border-success bg-success/10 text-success'
                            : 'border-destructive bg-destructive/10 text-destructive'
                          : answers[sentence.id]
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-dashed border-border bg-card text-muted-foreground'
                      }`}
                    >
                      {answers[sentence.id] || '___'}
                    </span>
                    {parts.length > 1 && parts[1] && <span className="text-foreground">{parts[1]}</span>}
                    <AnimatePresence>
                      {submitted && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
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
                    </AnimatePresence>
                  </div>
                </div>

                {!submitted && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(nuggetsBySentence[sentence.id] || []).map((option, idx) => {
                      const isSelected = answers[sentence.id] === option;
                      return (
                        <motion.button
                          key={`${sentence.id}-${idx}-${option}`}
                          type="button"
                          onClick={() => handleAnswerChange(sentence.id, option)}
                          whileTap={{ scale: 0.97 }}
                          className={`px-4 py-3 rounded-xl text-[14px] font-semibold border-2 transition-all text-center ${
                            isSelected
                              ? 'bg-primary/[0.06] text-primary border-primary ring-2 ring-primary/20'
                              : 'bg-card border-border/70 text-foreground hover:border-primary/40 hover:bg-primary/[0.03]'
                          }`}
                        >
                          {option}
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                <AnimatePresence>
                  {submitted && !isCorrect && (
                    <motion.div
                      className="px-3.5 py-2.5 bg-card rounded-xl border border-border/60"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <p className="text-[13px] text-muted-foreground">
                        Resposta correta:{' '}
                        <span className="font-semibold text-foreground">
                          {sentence.correctAnswers.join(', ')}
                        </span>
                      </p>
                      {sentence.explanation && (
                        <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
                          {sentence.explanation}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="submit"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Button
                onClick={handleSubmit}
                disabled={!allAnswered}
                className="w-full h-11 sm:h-12 text-sm sm:text-base rounded-2xl"
                size="lg"
              >
                Verificar respostas
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center space-y-1.5 py-2"
            >
              <p className="text-base font-semibold text-foreground">
                {correctCount} de {sentences.length} corretas
              </p>
              <p className="text-[13px] text-muted-foreground leading-relaxed max-w-md mx-auto">
                {getFeedbackMessage()}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
