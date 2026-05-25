import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CheckCircle2, XCircle, Timer, Trophy, Clock } from 'lucide-react';
import { useV7SoundEffects } from './v7/cinematic/useV7SoundEffects';
import confetti from 'canvas-confetti';
import { TimedQuizExerciseData } from '@/types/exerciseSchemas';
import { ExerciseHeader } from './_shared/ExerciseHeader';

type TimerState = 'waiting' | 'normal' | 'warning' | 'critical' | 'timeout' | 'answered';

interface TimedQuizExerciseProps {
  title: string;
  instruction: string;
  data: TimedQuizExerciseData;
  onComplete: (score: number) => void;
}

const MAX_QUESTIONS = 2;
const LETTER_BADGES = ['A', 'B', 'C', 'D', 'E', 'F'];

export function TimedQuizExercise({ title, instruction, data, onComplete }: TimedQuizExerciseProps) {
  const { timePerQuestion, bonusPerSecondLeft, timeoutPenalty, feedback } = data;
  const questions = (data.questions || []).filter(q => q.options && q.options.length >= 2).slice(0, MAX_QUESTIONS);
  const hasValidQuestions = questions.length > 0;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timePerQuestion);
  const [timerState, setTimerState] = useState<TimerState>('waiting');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalBonus, setTotalBonus] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showTimeoutFlash, setShowTimeoutFlash] = useState(false);
  const [results, setResults] = useState<Array<{ correct: boolean; bonus: number }>>([]);
  const [isFinished, setIsFinished] = useState(false);

  const { playSound, unlockAudio } = useV7SoundEffects(0.6, true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);
  const resultsRef = useRef<Array<{ correct: boolean; bonus: number }>>([]);
  const isCorrectRef = useRef<boolean | null>(null);

  const currentQuestion = hasValidQuestions ? questions[currentQuestionIndex] : null;
  const effectiveTime = currentQuestion?.timeOverride ?? timePerQuestion;

  // Start timer on mount / new question
  useEffect(() => {
    if (timerState === 'waiting') {
      const t = setTimeout(() => {
        setTimerState('normal');
        setTimeLeft(effectiveTime);
        playSound('click-confirm');
      }, 600);
      return () => clearTimeout(t);
    }
  }, [timerState, effectiveTime, playSound]);

  // Timer countdown
  useEffect(() => {
    if (timerState === 'normal' || timerState === 'warning' || timerState === 'critical') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const next = Math.max(0, +(prev - 0.1).toFixed(1));
          const sec = Math.ceil(next);
          if (sec !== lastTickRef.current && sec > 0) {
            lastTickRef.current = sec;
            if (next <= 3) {
              playSound('timer-tick', { volume: 1.4, pitch: 1.4 });
            } else if (next <= 5) {
              playSound('timer-tick', { volume: 1.1, pitch: 1.2 });
            } else {
              playSound('progress-tick', { volume: 0.5 });
            }
          }
          return next;
        });
      }, 100);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [timerState, playSound]);

  // Update timer state based on timeLeft
  useEffect(() => {
    if (timerState === 'answered' || timerState === 'waiting') return;
    if (timeLeft <= 0) {
      setTimerState('timeout');
    } else if (timeLeft <= 3) {
      setTimerState('critical');
    } else if (timeLeft <= 5) {
      setTimerState('warning');
    } else {
      setTimerState('normal');
    }
  }, [timeLeft, timerState]);

  // Handle timeout
  useEffect(() => {
    if (timerState === 'timeout' && !selectedOptionId && currentQuestion) {
      if (timerRef.current) clearInterval(timerRef.current);
      playSound('timer-buzzer');
      setShowTimeoutFlash(true);
      setTimeout(() => setShowTimeoutFlash(false), 400);

      const correctOption = currentQuestion.options.find(o => o.isCorrect);
      setIsCorrect(false);
      isCorrectRef.current = false;
      setSelectedOptionId(correctOption?.id ?? null);
      setShowExplanation(true);
      setResults(prev => { const next = [...prev, { correct: false, bonus: 0 }]; resultsRef.current = next; return next; });

      setTimeout(() => advanceQuestion(), 2500);
    }
  }, [timerState]);

  const handleSelectOption = useCallback((optionId: string) => {
    if (timerState === 'answered' || timerState === 'timeout' || selectedOptionId) return;
    unlockAudio();

    if (timerRef.current) clearInterval(timerRef.current);
    setTimerState('answered');
    setSelectedOptionId(optionId);

    const option = currentQuestion?.options.find(o => o.id === optionId);
    const correct = option?.isCorrect ?? false;
    setIsCorrect(correct);
    isCorrectRef.current = correct;
    setShowExplanation(true);

    const secondsLeft = Math.ceil(timeLeft);
    const bonus = correct ? secondsLeft * bonusPerSecondLeft : 0;
    const points = correct ? 100 + bonus : 0;

    setTotalPoints(prev => prev + points);
    if (bonus > 0) setTotalBonus(prev => prev + bonus);
    setResults(prev => { const next = [...prev, { correct, bonus }]; resultsRef.current = next; return next; });

    if (correct) {
      playSound('combo-hit');
      setTimeout(() => playSound('quiz-correct'), 150);
      if (bonus >= 10) {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.5 }, colors: ['#06b6d4', '#10b981', '#8b5cf6'] });
      }
    } else {
      playSound('quiz-wrong');
    }

    setTimeout(() => advanceQuestion(), 2200);
  }, [timerState, selectedOptionId, currentQuestion, timeLeft, bonusPerSecondLeft, playSound, unlockAudio]);

  const advanceQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOptionId(null);
      setIsCorrect(null);
      isCorrectRef.current = null;
      setShowExplanation(false);
      setTimerState('waiting');
      lastTickRef.current = 0;
    } else {
      setIsFinished(true);
      const latestResults = resultsRef.current;
      const correctCount = latestResults.filter(r => r.correct).length;
      const finalPercent = Math.min(100, Math.round((correctCount / questions.length) * 100));

      if (finalPercent >= 90) {
        playSound('level-up');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.4 } });
      } else if (finalPercent >= 60) {
        playSound('streak-bonus');
      }
      onComplete(finalPercent);
    }
  }, [currentQuestionIndex, questions.length, playSound, onComplete]);

  // Guard: no valid questions (after all hooks)
  if (!hasValidQuestions || !currentQuestion) {
    return (
      <div className="w-full max-w-lg mx-auto py-8 text-center space-y-4">
        <p className="text-muted-foreground text-sm">Exercício indisponível</p>
        <button onClick={() => onComplete(100)} className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium">
          Continuar
        </button>
      </div>
    );
  }

  const progressPercent = (timeLeft / effectiveTime) * 100;

  const barGradient = {
    waiting: 'from-muted to-muted',
    normal: 'from-primary to-success',
    warning: 'from-accent to-primary',
    critical: 'from-destructive to-destructive',
    timeout: 'from-destructive to-destructive',
    answered: 'from-muted to-muted',
  }[timerState];

  const timerBadgeBg = {
    waiting: 'bg-muted text-muted-foreground border-border/60',
    normal: 'bg-primary/10 text-primary border-primary/20',
    warning: 'bg-accent/10 text-accent border-accent/20',
    critical: 'bg-destructive/10 text-destructive border-destructive/20',
    timeout: 'bg-destructive/15 text-destructive border-destructive/30',
    answered: isCorrect ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border/60',
  }[timerState];

  // Result screen — feedback only, NO navigation buttons
  if (isFinished) {
    const correctCount = results.filter(r => r.correct).length;
    const finalPercent = Math.round((correctCount / questions.length) * 100);
    const feedbackMsg = finalPercent >= 90 ? feedback?.perfect : finalPercent >= 60 ? feedback?.good : feedback?.needsReview;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg mx-auto"
      >
        <div className="p-5 sm:p-7 space-y-6 border border-border/50 rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-card">
          <ExerciseHeader
            eyebrow="Quiz cronometrado"
            question={title}
            instruction={feedbackMsg || 'Exercício concluído!'}
            icon={Trophy}
          />

          {/* Stats */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-2xl bg-primary/[0.04] border border-primary/15 p-3 text-center">
              <p className="text-2xl font-bold text-primary tabular-nums">{correctCount}/{questions.length}</p>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">Acertos</p>
            </div>
            {totalBonus > 0 && (
              <div className="flex-1 rounded-2xl bg-accent/[0.04] border border-accent/15 p-3 text-center">
                <p className="text-2xl font-bold text-accent tabular-nums">+{totalBonus}</p>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">Bônus</p>
              </div>
            )}
          </div>
          {/* NO internal buttons — parent owns navigation */}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-5 sm:p-7 space-y-5 border border-border/50 rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-card relative">
      <AnimatePresence>
        {showTimeoutFlash && (
          <motion.div
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 bg-destructive/15 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <ExerciseHeader
        eyebrow={`Pergunta ${currentQuestionIndex + 1} de ${questions.length}`}
        question={currentQuestion.question}
        instruction={instruction}
        icon={Timer}
      />

      {/* Timer bar */}
      <div className="flex items-center gap-2.5">
        <motion.div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm font-bold tabular-nums ${timerBadgeBg}`}
          animate={timerState === 'critical' ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.6, repeat: Infinity }}
        >
          <Clock className="w-3.5 h-3.5" />
          {Math.ceil(timeLeft)}s
        </motion.div>
        <div className="flex-1 h-2 bg-muted/60 rounded-full overflow-hidden relative">
          <motion.div
            className={`h-full bg-gradient-to-r ${barGradient} rounded-full relative`}
            style={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
          {(timerState === 'normal' || timerState === 'warning') && (
            <div
              className="absolute top-0 h-full rounded-full opacity-40 blur-sm bg-gradient-to-r from-primary to-success"
              style={{ width: `${progressPercent}%` }}
            />
          )}
        </div>
      </div>

      {/* Question card */}
      <motion.div
        key={currentQuestionIndex}
        initial={{ opacity: 0, y: 12 }}
        animate={{
          opacity: 1,
          y: 0,
          x: timerState === 'critical' ? [-1, 1, -1, 0] : 0,
        }}
        transition={timerState === 'critical'
          ? { x: { duration: 0.3, repeat: Infinity } }
          : { duration: 0.35 }
        }
        className="space-y-4"
      >

        {/* Options — individual cards with letter badges */}
        <div className="space-y-2">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedOptionId === option.id;
            const showCorrect = showExplanation && option.isCorrect;
            const showWrong = showExplanation && isSelected && !option.isCorrect;
            const isDisabled = timerState === 'answered' || timerState === 'timeout';

            let optionClasses = 'border-border bg-card hover:border-primary/30 hover:shadow-sm text-foreground';
            let badgeClasses = 'bg-muted text-muted-foreground';

            if (showCorrect) {
              optionClasses = 'border-success bg-success/[0.06] text-success shadow-sm shadow-success/10';
              badgeClasses = 'bg-success text-success-foreground';
            } else if (showWrong) {
              optionClasses = 'border-destructive bg-destructive/[0.06] text-destructive shadow-sm shadow-destructive/10';
              badgeClasses = 'bg-destructive text-destructive-foreground';
            } else if (isDisabled) {
              optionClasses = 'border-border/50 bg-muted/20 text-muted-foreground cursor-default';
              badgeClasses = 'bg-muted/60 text-muted-foreground/60';
            }

            return (
              <motion.button
                key={option.id}
                onClick={() => handleSelectOption(option.id)}
                disabled={isDisabled}
                whileTap={!isDisabled ? { scale: 0.98 } : {}}
                animate={showWrong ? { x: [-2, 2, -2, 0] } : {}}
                transition={showWrong ? { duration: 0.25 } : {}}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 flex items-center gap-3 ${optionClasses}`}
              >
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${badgeClasses}`}>
                  {showCorrect ? <CheckCircle2 className="w-4 h-4" /> : showWrong ? <XCircle className="w-4 h-4" /> : LETTER_BADGES[idx]}
                </span>
                <span className="flex-1">{option.text}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Explanation */}
        <AnimatePresence>
          {showExplanation && currentQuestion.explanation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 rounded-xl bg-muted/40 border border-border"
            >
              <p className="text-xs text-muted-foreground leading-relaxed">{currentQuestion.explanation}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bonus indicator */}
        <AnimatePresence>
          {timerState === 'answered' && isCorrect && Math.ceil(timeLeft) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-1.5 py-1"
            >
              <Zap className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-bold text-accent">
                +{Math.ceil(timeLeft) * bonusPerSecondLeft} bônus de velocidade
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeout indicator */}
        <AnimatePresence>
          {timerState === 'timeout' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-1"
            >
              <span className="text-xs font-semibold text-destructive flex items-center justify-center gap-1.5 bg-destructive/[0.06] rounded-lg py-1.5 px-3 mx-auto w-fit">
                <Timer className="w-3.5 h-3.5" /> Tempo esgotado
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
