import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { ExerciseErrorCard } from './ExerciseErrorCard';
import { useV7SoundEffects } from './v7/cinematic/useV7SoundEffects';
import confetti from 'canvas-confetti';
import { ExerciseHeader } from './_shared/ExerciseHeader';

interface Scenario {
  id: string;
  text: string;
  correctPlatform: string;
}

interface Platform {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface PlatformMatchExerciseProps {
  title: string;
  instruction: string;
  scenarios: Scenario[];
  platforms: Platform[];
  onComplete: (score: number) => void;
}

const normalizePlatformToken = (value: string | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export function PlatformMatchExercise({
  title,
  instruction,
  scenarios,
  platforms,
  onComplete,
}: PlatformMatchExerciseProps) {
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const { playSound } = useV7SoundEffects(0.6, true);
  const advanceTimerRef = useRef<number | null>(null);

  const platformLookup = useMemo(() => {
    const lookup = new Map<string, Platform>();
    for (const platform of platforms) {
      for (const key of [platform.id, platform.name]) {
        const normalizedKey = normalizePlatformToken(key);
        if (normalizedKey) lookup.set(normalizedKey, platform);
      }
    }
    return lookup;
  }, [platforms]);

  const resolveScenarioPlatform = (scenario: Scenario) => {
    const normalizedKey = normalizePlatformToken(scenario.correctPlatform);
    return normalizedKey ? platformLookup.get(normalizedKey) : undefined;
  };

  const getScenarioCorrectPlatformId = (scenario: Scenario) =>
    resolveScenarioPlatform(scenario)?.id ?? scenario.correctPlatform;
  const getScenarioCorrectPlatformName = (scenario: Scenario) =>
    resolveScenarioPlatform(scenario)?.name ?? scenario.correctPlatform;

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  if (!scenarios || scenarios.length === 0) {
    return (
      <ExerciseErrorCard
        title="Exercício sem cenários"
        message="Este exercício não possui cenários configurados."
        details="Campo 'scenarios' está ausente ou vazio."
      />
    );
  }
  if (!platforms || platforms.length === 0) {
    return (
      <ExerciseErrorCard
        title="Exercício sem plataformas"
        message="Este exercício não possui plataformas configuradas."
        details="Campo 'platforms' está ausente ou vazio."
      />
    );
  }

  const currentScenario = scenarios[currentScenarioIndex];
  const currentCorrectPlatformId = getScenarioCorrectPlatformId(currentScenario);
  const currentCorrectPlatformName = getScenarioCorrectPlatformName(currentScenario);
  const isLastScenario = currentScenarioIndex === scenarios.length - 1;
  const allAnswered = Object.keys(answers).length === scenarios.length;

  const handlePlatformSelect = (platformId: string) => {
    if (showFeedback) return;
    const correct = platformId === currentCorrectPlatformId;
    const nextAnswers = { ...answers, [currentScenario.id]: platformId };

    setIsCorrect(correct);
    setShowFeedback(true);
    setAnswers(nextAnswers);

    if (correct) playSound('snap-success');
    else playSound('snap-error');

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = window.setTimeout(() => {
      setShowFeedback(false);
      if (!isLastScenario) {
        setCurrentScenarioIndex((prev) => prev + 1);
      } else {
        const correctCount = scenarios.filter(
          (scenario) => nextAnswers[scenario.id] === getScenarioCorrectPlatformId(scenario),
        ).length;
        const score = Math.round((correctCount / scenarios.length) * 100);
        if (score === 100) {
          playSound('level-up');
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.5 },
            colors: ['#6366F1', '#8B5CF6', '#34D399'],
          });
        } else if (score >= 50) {
          playSound('completion');
        }
        setIsFinished(true);
        onComplete(score);
      }
      advanceTimerRef.current = null;
    }, 1500);
  };

  return (
    <div className="p-5 sm:p-7 space-y-6 border border-border/50 rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-card">
      <ExerciseHeader
        eyebrow={`Cenário ${currentScenarioIndex + 1} de ${scenarios.length}`}
        question={title}
        instruction={instruction}
      />

      {/* Stepper */}
      <div className="flex items-center gap-1.5">
        {scenarios.map((_, idx) => {
          const isDone = idx < currentScenarioIndex;
          const isCurrent = idx === currentScenarioIndex;
          const wasCorrect =
            isDone &&
            answers[scenarios[idx].id] === getScenarioCorrectPlatformId(scenarios[idx]);
          return (
            <div
              key={idx}
              className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                isDone && wasCorrect
                  ? 'bg-success'
                  : isDone
                    ? 'bg-destructive/60'
                    : isCurrent
                      ? 'bg-primary'
                      : 'bg-muted'
              }`}
            />
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentScenario.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="space-y-4"
        >
          {/* Situation card */}
          <div className="px-4 py-4 bg-muted/40 rounded-2xl border border-border/60">
            <p className="text-[14px] sm:text-[15px] font-medium text-foreground leading-relaxed">
              {currentScenario.text}
            </p>
          </div>

          {/* Platforms grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {platforms.map((platform, idx) => {
              const isThisCorrect = platform.id === currentCorrectPlatformId;
              const isSelected = answers[currentScenario.id] === platform.id;

              let stateClasses =
                'border-border/70 bg-card hover:border-primary/40 hover:bg-primary/[0.03]';
              if (showFeedback && isThisCorrect) {
                stateClasses = 'border-success bg-success/5';
              } else if (showFeedback && isSelected && !isThisCorrect) {
                stateClasses = 'border-destructive bg-destructive/5';
              }

              return (
                <motion.button
                  key={platform.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.22 }}
                  whileTap={!showFeedback ? { scale: 0.985 } : undefined}
                  onClick={() => handlePlatformSelect(platform.id)}
                  disabled={showFeedback}
                  className={`relative px-4 py-4 rounded-2xl border-2 transition-all duration-200 min-h-[88px] flex flex-col items-center justify-center gap-2 text-center ${stateClasses} ${
                    showFeedback ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {platform.icon}
                  </span>
                  <span className="text-[13px] sm:text-sm font-semibold text-foreground leading-snug">
                    {platform.name}
                  </span>

                  {showFeedback && isThisCorrect && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-success p-1 shadow-sm"
                    >
                      <Check className="w-3 h-3 text-white" strokeWidth={3.5} />
                    </motion.div>
                  )}
                  {showFeedback && isSelected && !isThisCorrect && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-1 shadow-sm"
                    >
                      <X className="w-3 h-3 text-white" strokeWidth={3.5} />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`p-3.5 rounded-2xl border-2 ${
                  isCorrect
                    ? 'bg-success/5 border-success/40'
                    : 'bg-destructive/5 border-destructive/40'
                }`}
              >
                <div className="flex items-start gap-2">
                  {isCorrect ? (
                    <div className="rounded-full bg-success/15 p-1 flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-success" strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="rounded-full bg-destructive/15 p-1 flex-shrink-0">
                      <X className="w-3.5 h-3.5 text-destructive" strokeWidth={3} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {isCorrect ? 'Correto!' : 'Não foi dessa vez'}
                    </p>
                    {!isCorrect && (
                      <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
                        Resposta correta:{' '}
                        <span className="font-semibold text-foreground">
                          {currentCorrectPlatformName}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {allAnswered && !showFeedback && !isFinished && (
        <p className="text-center text-sm text-muted-foreground">Calculando seu resultado…</p>
      )}
    </div>
  );
}
