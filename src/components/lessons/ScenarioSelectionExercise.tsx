// Card global removido — usa div puro para evitar texture/gradiente inline
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, ChevronRight, Check } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { ExerciseErrorCard } from './ExerciseErrorCard';
import { useV7SoundEffects } from './v7/cinematic/useV7SoundEffects';
import { ensureElementVisible } from './v8/v8ScrollUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { ExerciseHeader } from './_shared/ExerciseHeader';
import { ChoiceCard, type ChoiceState } from './_shared/ChoiceCard';

interface Scenario {
  id: string;
  situation?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  title?: string;
  description?: string;
  
  isCorrect?: boolean;
  feedback?: string;
}

interface ScenarioData {
  scenarios: Scenario[];
  correctExplanation?: string;
  followUpQuestion?: string;
  followUpAnswer?: string;
}

interface ScenarioSelectionExerciseProps {
  title: string;
  instruction: string;
  scenarios?: Scenario[];
  data?: ScenarioData;
  onComplete: (score: number) => void;
}

export function ScenarioSelectionExercise({ 
  title, 
  instruction, 
  scenarios,
  data,
  onComplete 
}: ScenarioSelectionExerciseProps) {
  const scenarioList = scenarios || data?.scenarios || [];
  const isSimpleChoice = scenarioList.length > 0 && 'isCorrect' in scenarioList[0];

  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { selected: string; correct: boolean }>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { playSound } = useV7SoundEffects(0.6, true);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const currentScenario = isSimpleChoice ? scenarioList[0] : scenarioList[currentScenarioIndex];
  const totalSituationScenarios = isSimpleChoice ? 1 : scenarioList.length;
  const isLastScenario = currentScenarioIndex >= totalSituationScenarios - 1;

  useEffect(() => {
    if (showExplanation && feedbackRef.current) {
      const timer = setTimeout(() => {
        ensureElementVisible(feedbackRef.current, { safeBottom: 160 });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [showExplanation]);

  if (!scenarioList.length) {
    return (
      <ExerciseErrorCard 
        title="⚠️ Exercício Sem Cenários"
        message="Este exercício de seleção de cenários não possui opções configuradas."
        details="Campo 'scenarios' ou 'data.scenarios' está vazio."
      />
    );
  }

  const isCorrectCurrent = isSimpleChoice
    ? scenarioList.find(s => s.id === selectedAnswer)?.isCorrect || false
    : selectedAnswer === currentScenario?.correctAnswer;

  const displayOptions = currentScenario?.options || [];

  const handleSubmit = () => {
    setShowExplanation(true);
    const correct = isSimpleChoice
      ? scenarioList.find(s => s.id === selectedAnswer)?.isCorrect || false
      : selectedAnswer === currentScenario?.correctAnswer;

    if (correct) {
      playSound('quiz-correct');
    } else {
      playSound('quiz-wrong');
    }

    const newAnswers = { ...answers, [currentScenarioIndex]: { selected: selectedAnswer, correct } };
    setAnswers(newAnswers);

    if (isSimpleChoice || isLastScenario) {
      const correctCount = Object.values(newAnswers).filter(a => a.correct).length;
      const finalScore = Math.round((correctCount / totalSituationScenarios) * 100);
      onComplete(finalScore);
    }
  };

  const handleNextScenario = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentScenarioIndex(prev => prev + 1);
      setSelectedAnswer('');
      setShowExplanation(false);
      setIsTransitioning(false);
    }, 300);
  };

  return (
    <div className="p-5 pb-24 sm:p-7 sm:pb-7 space-y-6 border border-border/50 rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-card overflow-visible">
      {/* Header */}
      <ExerciseHeader
        eyebrow={isSimpleChoice ? 'Exercício' : `Cenário ${currentScenarioIndex + 1} de ${totalSituationScenarios}`}
        question={title}
        instruction={instruction}
      />

      {/* Progress bar for multi-scenario */}
      {!isSimpleChoice && totalSituationScenarios > 1 && (
        <div className="space-y-2">
          {/* Step indicators */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSituationScenarios }).map((_, i) => {
              const isDone = i < currentScenarioIndex || (i === currentScenarioIndex && showExplanation);
              const isCurrent = i === currentScenarioIndex && !showExplanation;
              const wasCorrect = answers[i]?.correct;
              return (
                <div key={i} className="flex items-center gap-1.5 flex-1">
                  <div className={`
                    h-2 flex-1 rounded-full transition-all duration-500
                    ${isDone && wasCorrect ? 'bg-success' : ''}
                    ${isDone && !wasCorrect ? 'bg-destructive/60' : ''}
                    ${isDone && answers[i] === undefined && showExplanation && i === currentScenarioIndex
                      ? (isCorrectCurrent ? 'bg-success' : 'bg-destructive/60')
                      : ''}
                    ${isCurrent ? 'bg-primary' : ''}
                    ${!isDone && !isCurrent ? 'bg-muted' : ''}
                  `} />
                </div>
              );
            })}
          </div>
          {Object.keys(answers).length > 0 && (
            <div className="flex items-center justify-end">
              <span className="text-xs text-muted-foreground">
                {Object.values(answers).filter(a => a.correct).length} acerto{Object.values(answers).filter(a => a.correct).length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {isSimpleChoice ? (
        <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
          {scenarioList.map((sc, idx) => {
            const isSelected = selectedAnswer === sc.id;
            let state: ChoiceState = 'idle';
            if (showExplanation && isSelected && sc.isCorrect) state = 'correct';
            else if (showExplanation && isSelected && !sc.isCorrect) state = 'wrong';
            else if (showExplanation && sc.isCorrect) state = 'reveal-correct';
            else if (isSelected) state = 'selected';

            return (
              <ChoiceCard
                key={sc.id}
                index={idx}
                title={sc.title || ''}
                description={sc.description}
                state={state}
                disabled={showExplanation}
                onClick={() => {
                  if (!showExplanation) {
                    setSelectedAnswer(sc.id);
                    setTimeout(() => {
                      setShowExplanation(true);
                      const correct = sc.isCorrect || false;
                      if (correct) playSound('quiz-correct');
                      else playSound('quiz-wrong');
                    }, 100);
                  }
                }}
              />
            );
          })}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScenarioIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="space-y-3"
          >
            {/* Situation card */}
            <div className="px-4 py-3.5 bg-muted/40 rounded-2xl border border-border/60">
              <p className="text-[14px] sm:text-[15px] font-medium text-foreground leading-relaxed break-words">
                {currentScenario?.situation}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2.5">
              {displayOptions.map((option, index) => {
                const isSelected = selectedAnswer === option;
                const isThisCorrect = option === currentScenario?.correctAnswer;

                let state: ChoiceState = 'idle';
                if (showExplanation && isThisCorrect && isSelected) state = 'correct';
                else if (showExplanation && isThisCorrect) state = 'reveal-correct';
                else if (showExplanation && isSelected) state = 'wrong';
                else if (isSelected) state = 'selected';

                return (
                  <ChoiceCard
                    key={index}
                    index={index}
                    title={option}
                    state={state}
                    disabled={showExplanation}
                    onClick={() => !showExplanation && setSelectedAnswer(option)}
                  />
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Feedback + Navigation */}
      <div
        ref={feedbackRef}
        className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 bg-card/95 backdrop-blur-xl border-t border-border/60 shadow-2xl sm:static sm:inset-auto sm:z-auto sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:shadow-none"
      >
        {!showExplanation && !isSimpleChoice ? (
          <div
            onClick={() => {
              if (!selectedAnswer) {
                toast("Selecione uma das opções acima primeiro", { icon: "☝️" });
              }
            }}
          >
            <Button
              onClick={handleSubmit}
              disabled={!selectedAnswer}
              className={`w-full h-10 sm:h-12 text-sm sm:text-base transition-all duration-300 ${
                !selectedAnswer
                  ? '!bg-muted !text-muted-foreground !shadow-none !from-transparent !to-transparent'
                  : ''
              }`}
              size="lg"
            >
              {selectedAnswer ? 'Confirmar Resposta' : 'Selecione uma opção acima'}
            </Button>
          </div>
        ) : showExplanation && isSimpleChoice ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-3"
          >
            {(() => {
              const selected = scenarioList.find(s => s.id === selectedAnswer);
              const correct = selected?.isCorrect || false;
              const feedbackText = selected?.feedback || selected?.description;
              return (
                <div className={`p-3 rounded-lg border-2 ${
                  correct
                    ? 'bg-success/5 border-success/20'
                    : 'bg-destructive/5 border-destructive/20'
                }`}>
                  <div className="flex items-start gap-2">
                    {correct ? (
                      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold mb-1 text-sm">
                        {correct ? 'Correto! 🎉' : 'Não foi dessa vez'}
                      </p>
                      {feedbackText && (
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words">
                          {feedbackText}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            <Button
              onClick={() => {
                const selected = scenarioList.find(s => s.id === selectedAnswer);
                const correct = selected?.isCorrect || false;
                onComplete(correct ? 100 : 0);
              }}
              className="w-full h-10 sm:h-12 text-sm sm:text-base"
              size="lg"
            >
              Continuar <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        ) : showExplanation && !isSimpleChoice ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-3"
          >
            <div className={`p-3 rounded-lg border-2 ${
              isCorrectCurrent
                ? 'bg-success/5 border-success/20'
                : 'bg-destructive/5 border-destructive/20'
            }`}>
              <div className="flex items-start gap-2">
                {isCorrectCurrent ? (
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold mb-1 text-sm">
                    {isCorrectCurrent ? 'Correto! 🎉' : 'Não foi dessa vez'}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words">
                    {currentScenario?.explanation}
                  </p>
                </div>
              </div>
            </div>

            {!isLastScenario && (
              <Button
                onClick={handleNextScenario}
                disabled={isTransitioning}
                className="w-full h-10 sm:h-12 text-sm sm:text-base"
                size="lg"
              >
                Próximo Cenário <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}

            {isLastScenario && (
              <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <Check className="w-3.5 h-3.5 text-success" strokeWidth={2.5} />
                <span>Exercício concluído — {Object.values(answers).filter(a => a.correct).length} de {totalSituationScenarios} corretos</span>
              </div>
            )}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}