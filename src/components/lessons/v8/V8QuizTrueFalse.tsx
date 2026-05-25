import { useState, useCallback, useRef, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, ArrowRight, Scale, RotateCcw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { V8InlineQuiz } from "@/types/v8Lesson";
import { V8AudioPlayer } from "./V8AudioPlayer";
import { scheduleCTAScroll, scheduleSmartAnchor, V8_SAFE_BOTTOM_INLINE } from "./v8ScrollUtils";
import { useV7SoundEffects } from "@/components/lessons/v7/cinematic/useV7SoundEffects";
import { useAudioFirstLock } from "./useAudioFirstLock";
import { V8AudioLockOverlay } from "./V8AudioLockOverlay";
import { fireInlineConfetti } from "./v8Confetti";

interface V8QuizTrueFalseProps {
  quiz: V8InlineQuiz;
  onAnswer: (correct: boolean) => void;
  onContinue?: () => void;
  isActiveAudio?: boolean;
  isActive?: boolean;
}

type QuizState = "answering" | "correct" | "wrong" | "reinforcement";

export const V8QuizTrueFalse = ({
  quiz,
  onAnswer,
  onContinue,
  isActiveAudio = false,
  isActive = true,
}: V8QuizTrueFalseProps) => {
  const statementId = useId();
  const [selected, setSelected] = useState<boolean | null>(null);
  const [state, setState] = useState<QuizState>("answering");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const optionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const { playSound } = useV7SoundEffects(0.6, true);
  const { audioLocked, justUnlocked, onAudioEnded } = useAudioFirstLock(quiz.audioUrl, isActiveAudio);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;
    if (selected === null && state === "answering") return;
    if (state === "wrong" || state === "reinforcement") {
      return scheduleSmartAnchor(() => rootRef.current, () => ctaRef.current, { safeBottom: V8_SAFE_BOTTOM_INLINE });
    }
    return scheduleCTAScroll(() => ctaRef.current, undefined, { safeBottom: V8_SAFE_BOTTOM_INLINE });
  }, [selected, state, isActive]);

  const handleSelect = useCallback(
    (value: boolean) => {
      if (state !== "answering" || audioLocked) return;
      setSelected(value);
    },
    [state, audioLocked]
  );

  const handleConfirm = useCallback(() => {
    if (selected === null) return;
    const isCorrect = selected === quiz.isTrue;
    if (isCorrect) {
      setState("correct");
      onAnswer(true);
      playSound("quiz-correct");
      fireInlineConfetti();
    } else {
      setState("wrong");
      playSound("quiz-wrong");
    }
  }, [selected, quiz.isTrue, onAnswer, playSound]);

  const handleTryAgain = useCallback(() => {
    setSelected(null);
    setState("answering");
  }, []);

  const handleContinueAfterWrong = useCallback(() => {
    onAnswer(false);
    onContinue?.();
  }, [onAnswer, onContinue]);

  const handleShowReinforcement = () => setState("reinforcement");
  const isAnswered = state !== "answering";

  // Roving tabIndex + arrow keys (WAI-ARIA radiogroup pattern)
  const TF_VALUES: readonly boolean[] = [true, false];
  const handleRadioKeyDown = useCallback((e: React.KeyboardEvent, currentIdx: number) => {
    if (isAnswered || audioLocked) return;
    const lastIdx = TF_VALUES.length - 1;
    let nextIdx = currentIdx;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        nextIdx = currentIdx === lastIdx ? 0 : currentIdx + 1;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        nextIdx = currentIdx === 0 ? lastIdx : currentIdx - 1;
        break;
      case "Home":
        nextIdx = 0;
        break;
      case "End":
        nextIdx = lastIdx;
        break;
      default:
        return;
    }
    e.preventDefault();
    setFocusedIndex(nextIdx);
    setSelected(TF_VALUES[nextIdx]);
    optionButtonsRef.current[nextIdx]?.focus();
  }, [isAnswered, audioLocked]);

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-5 pb-8"
    >
      {/* Badge */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200">
          <Scale className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
            Verdadeiro ou Falso
          </span>
        </div>
      </div>

      {/* Question context */}
      {quiz.question && (
        <p className="text-sm text-slate-500 leading-relaxed">{quiz.question}</p>
      )}

      {/* Statement */}
      <div id={statementId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-lg font-semibold text-slate-900 leading-snug italic">
          "{quiz.statement}"
        </p>
      </div>

      {/* Audio player for narration — locks buttons until finished */}
      {quiz.audioUrl && state === "answering" && isActiveAudio && (
        <V8AudioPlayer audioUrl={quiz.audioUrl} autoPlay onEnded={onAudioEnded} />
      )}

      {/* Audio lock hint */}
      {audioLocked && state === "answering" && <V8AudioLockOverlay />}

      {/* True / False buttons */}
      <div
        role="radiogroup"
        aria-labelledby={statementId}
        className={`grid grid-cols-2 gap-3 transition-all duration-300 ${audioLocked ? "opacity-40 pointer-events-none" : "opacity-100"} ${justUnlocked ? "ring-2 ring-indigo-400/60 ring-offset-2 rounded-xl animate-pulse" : ""}`}
      >
        {TF_VALUES.map((value, idx) => {
          const label = value ? "Verdadeiro" : "Falso";
          let borderColor = "border-slate-200";
          let bgColor = "bg-white";
          let textColor = "text-slate-700";

          if (isAnswered) {
            if (value === quiz.isTrue) {
              borderColor = "border-emerald-500/50";
              bgColor = "bg-emerald-50";
              textColor = "text-emerald-700";
            } else if (value === selected) {
              borderColor = "border-red-500/50";
              bgColor = "bg-red-50";
              textColor = "text-red-700";
            } else {
              textColor = "text-slate-400";
            }
          } else if (selected === value) {
            borderColor = "border-indigo-500/50";
            bgColor = "bg-indigo-50";
            textColor = "text-slate-900";
          }

          return (
            <motion.button
              key={String(value)}
              ref={(el) => { optionButtonsRef.current[idx] = el; }}
              role="radio"
              aria-checked={selected === value}
              tabIndex={focusedIndex === idx ? 0 : -1}
              onClick={() => {
                handleSelect(value);
                setFocusedIndex(idx);
              }}
              onKeyDown={(e) => handleRadioKeyDown(e, idx)}
              disabled={isAnswered || audioLocked}
              whileTap={!isAnswered && !audioLocked ? { scale: 0.97 } : undefined}
              className={`w-full text-center px-4 py-4 rounded-xl border-2 ${borderColor} ${bgColor} ${textColor} transition-colors text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`}
            >
              <div className="flex items-center justify-center gap-2">
                {isAnswered && value === quiz.isTrue && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                )}
                {isAnswered && value === selected && value !== quiz.isTrue && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span>{label}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Confirm */}
      <AnimatePresence>
        {state === "answering" && selected !== null && !audioLocked && (
          <motion.button
            ref={ctaRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={handleConfirm}
            className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25"
          >
            Confirmar
          </motion.button>
        )}
      </AnimatePresence>

      {/* Feedback correct */}
      <AnimatePresence>
        {state === "correct" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="font-semibold text-emerald-700 text-sm">Correto!</span>
              </div>
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-700 uppercase tracking-wide"
                aria-label="Mais um acerto"
              >
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" aria-hidden="true" />
                +1 acerto
              </motion.span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{quiz.explanation}</p>
            {quiz.explanationAudioUrl && isActiveAudio && (
              <V8AudioPlayer audioUrl={quiz.explanationAudioUrl} autoPlay />
            )}
            {onContinue && (
              <button
                ref={ctaRef}
                onClick={onContinue}
                className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback wrong */}
      <AnimatePresence>
        {state === "wrong" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="font-semibold text-red-700 text-sm">Não foi dessa vez</span>
            </div>
            <div className="rounded-lg bg-white/60 border border-red-100 px-3 py-2 space-y-1">
              <p className="text-xs text-slate-600">
                Você marcou: <strong className="text-red-700">{selected === true ? "Verdadeiro" : selected === false ? "Falso" : "—"}</strong>
              </p>
              <p className="text-xs text-slate-600">
                Correto: <strong className="text-emerald-700">{quiz.isTrue ? "Verdadeiro" : "Falso"}</strong>
              </p>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{quiz.explanation}</p>
            {quiz.explanationAudioUrl && isActiveAudio && (
              <V8AudioPlayer audioUrl={quiz.explanationAudioUrl} autoPlay />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <Button
                ref={ctaRef}
                onClick={handleTryAgain}
                className="w-full gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white border-0 shadow-md shadow-indigo-500/20"
              >
                <RotateCcw className="w-4 h-4" />
                Tentar Novamente
              </Button>
              {onContinue && (
                <Button
                  onClick={handleContinueAfterWrong}
                  variant="outline"
                  className="w-full gap-2"
                >
                  Continuar Aula
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reinforcement */}
      <AnimatePresence>
        {state === "reinforcement" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3"
          >
            <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
              Reforço
            </span>
            <p className="text-sm text-slate-700 leading-relaxed">{quiz.reinforcement}</p>
            {quiz.reinforcementAudioUrl && (
              <V8AudioPlayer audioUrl={quiz.reinforcementAudioUrl} autoPlay={isActiveAudio} />
            )}
            {onContinue && (
              <button
                ref={ctaRef}
                onClick={handleContinueAfterWrong}
                className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
