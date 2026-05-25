import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lightbulb } from 'lucide-react';
import { ExerciseErrorCard } from './ExerciseErrorCard';
import { splitByPlaceholder } from '@/lib/exerciseConstants';
import { useV7SoundEffects } from './v7/cinematic/useV7SoundEffects';
import { toast } from 'sonner';
import { ExerciseHeader } from './_shared/ExerciseHeader';
import { ChoiceCard, type ChoiceState } from './_shared/ChoiceCard';

interface Sentence {
  id: string;
  text: string;
  correctAnswers: string[];
  options?: string[];
  hints?: string[];
}

interface CompleteSentenceExerciseProps {
  title: string;
  instruction: string;
  sentences: Sentence[];
  onComplete: (score: number) => void;
}

export function CompleteSentenceExercise({
  title,
  instruction,
  sentences,
  onComplete,
}: CompleteSentenceExerciseProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [highlightMissing, setHighlightMissing] = useState(false);
  const { playSound } = useV7SoundEffects(0.6, true);

  if (!sentences || sentences.length === 0) {
    return (
      <ExerciseErrorCard
        title="Exercício sem sentenças"
        message="Este exercício não possui sentenças configuradas."
        details="Campo 'sentences' está ausente ou vazio."
      />
    );
  }

  const allAnswered = sentences.every((s) => answers[s.id]?.trim());

  const handleSubmit = () => {
    if (!allAnswered) {
      setHighlightMissing(true);
      toast.warning('Preencha todas as lacunas antes de verificar.');
      playSound('error');
      setTimeout(() => setHighlightMissing(false), 2500);
      return;
    }

    const newResults: Record<string, boolean> = {};
    let correctCount = 0;

    sentences.forEach((sentence) => {
      const userAnswer = answers[sentence.id]?.trim().toLowerCase() || '';
      const isCorrect = sentence.correctAnswers.some(
        (correct) => correct.toLowerCase() === userAnswer,
      );
      newResults[sentence.id] = isCorrect;
      if (isCorrect) correctCount++;
    });

    setResults(newResults);
    setSubmitted(true);

    const score = (correctCount / sentences.length) * 100;
    if (score === 100) playSound('completion');
    else if (score >= 50) playSound('success');
    else playSound('error');

    onComplete(score);
  };

  return (
    <div className="p-5 sm:p-7 space-y-6 border border-border/50 rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-card animate-fade-in">
      <ExerciseHeader question={title} instruction={instruction} />

      <div className="space-y-7">
        {sentences.map((sentence, sIdx) => {
          const parts = splitByPlaceholder(sentence.text);
          const hasOptions = sentence.options && sentence.options.length > 0;
          const isCorrect = results[sentence.id];

          return (
            <div key={sentence.id} className="space-y-3">
              {sentences.length > 1 && (
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Questão {sIdx + 1}
                </div>
              )}

              <p className="text-[15px] sm:text-base text-foreground font-medium leading-relaxed">
                {parts[0]}
                <span className="text-primary font-semibold">_______</span>
                {parts[1]}
              </p>

              {sentence.hints && sentence.hints.length > 0 && !submitted && (
                <div className="flex items-start gap-2 px-4 py-3 bg-muted/40 rounded-2xl border border-border/60">
                  <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={2.25} />
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">Dica: </span>
                    {sentence.hints.join(' • ')}
                  </p>
                </div>
              )}

              {hasOptions ? (
                <div
                  className={`space-y-2.5 ${
                    highlightMissing && !answers[sentence.id]?.trim() ? 'animate-shake' : ''
                  }`}
                >
                  {sentence.options!.map((option, oIdx) => {
                    const isSelected = answers[sentence.id] === option;
                    const optionIsCorrect = sentence.correctAnswers.includes(option);

                    let state: ChoiceState = 'idle';
                    if (submitted && isSelected && optionIsCorrect) state = 'correct';
                    else if (submitted && isSelected && !optionIsCorrect) state = 'wrong';
                    else if (submitted && optionIsCorrect) state = 'reveal-correct';
                    else if (isSelected) state = 'selected';

                    return (
                      <ChoiceCard
                        key={`${sentence.id}-${option}`}
                        index={oIdx}
                        title={option}
                        state={state}
                        disabled={submitted}
                        onClick={() =>
                          !submitted &&
                          setAnswers((prev) => ({ ...prev, [sentence.id]: option }))
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <Input
                  value={answers[sentence.id] || ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [sentence.id]: e.target.value }))
                  }
                  disabled={submitted}
                  placeholder="Digite aqui..."
                  className={`h-11 sm:h-12 rounded-2xl border-2 px-4 text-[15px] transition-all ${
                    submitted
                      ? isCorrect
                        ? 'border-success bg-success/5'
                        : 'border-destructive bg-destructive/5'
                      : highlightMissing && !answers[sentence.id]?.trim()
                        ? 'border-destructive/60 animate-shake'
                        : 'border-border/60 focus-visible:border-primary'
                  }`}
                />
              )}

              {submitted && !isCorrect && (
                <p className="text-[13px] text-muted-foreground">
                  Resposta esperada:{' '}
                  <span className="font-semibold text-foreground">
                    {sentence.correctAnswers[0]}
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!submitted && (
        <Button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="w-full h-11 sm:h-12 text-sm sm:text-base rounded-2xl"
          size="lg"
        >
          {allAnswered
            ? 'Verificar respostas'
            : `Faltam ${sentences.filter((s) => !answers[s.id]?.trim()).length} respostas`}
        </Button>
      )}

      {submitted && (
        <div className="text-center py-3">
          <p className="text-sm font-medium text-muted-foreground">
            Você acertou{' '}
            <span className="font-semibold text-foreground">
              {Object.values(results).filter(Boolean).length} de {sentences.length}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
