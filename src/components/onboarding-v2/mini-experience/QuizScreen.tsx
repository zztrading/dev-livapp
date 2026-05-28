import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import type { QuizDefinition } from "./quizData";

interface QuizScreenProps {
  quiz: QuizDefinition;
  /** Texto de cabeçalho — ex: "Desafio · 2 de 9" */
  stepLabel: string;
  /** Cor de destaque do nível */
  difficulty: "easy" | "medium" | "hard";
  onSubmit: (answer: string, correct: boolean) => Promise<void>;
  onContinue: () => void | Promise<void>;
}

const DIFFICULTY_BADGE: Record<
  QuizScreenProps["difficulty"],
  { label: string; bg: string; text: string }
> = {
  easy: { label: "Fácil", bg: "bg-emerald-50", text: "text-emerald-600" },
  medium: { label: "Médio", bg: "bg-amber-50", text: "text-amber-600" },
  hard: { label: "Hard", bg: "bg-rose-50", text: "text-rose-600" },
};

/**
 * Quiz screen — padrão premium Linear/Vercel/Stripe-inspired.
 * App shell com header sticky (DominioBar), body scrollável, CTA sticky bottom.
 */
export const QuizScreen = ({
  quiz,
  stepLabel,
  difficulty,
  onSubmit,
  onContinue,
}: QuizScreenProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [continuing, setContinuing] = useState(false);

  const isCorrect = selected === quiz.correctId;
  const feedback = selected ? quiz.feedback[selected] : null;

  const handleSelect = useCallback(
    async (id: string) => {
      if (selected !== null || submitting) return;
      setSubmitting(true);
      setSelected(id);
      const correct = id === quiz.correctId;
      if (correct) {
        confetti({
          particleCount: 60,
          spread: 90,
          origin: { y: 0.55 },
          colors: ["#10b981", "#22c55e", "#84cc16", "#fbbf24", "#6D28D9"],
          startVelocity: 35,
          gravity: 1.0,
          scalar: 0.9,
        });
        setTimeout(() => {
          confetti({
            particleCount: 30,
            spread: 120,
            origin: { y: 0.45, x: 0.5 },
            colors: ["#10b981", "#fbbf24", "#6D28D9"],
            startVelocity: 25,
            gravity: 1.2,
            scalar: 0.7,
          });
        }, 200);
      }
      await onSubmit(id, correct);
      setSubmitting(false);
    },
    [selected, submitting, quiz.correctId, onSubmit],
  );

  useEffect(() => {
    setSelected(null);
    setSubmitting(false);
  }, [quiz.key]);

  const badge = DIFFICULTY_BADGE[difficulty];

  return (
    <div className="min-h-screen flex flex-col bg-white pt-24">
      {/* Body scrollable */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32 max-w-md w-full mx-auto flex flex-col gap-3.5">
        {/* Eyebrow: label + difficulty chip */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-violet-700">
            {stepLabel}
          </span>
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
        </div>

        {/* Question — context inline + pergunta H1 */}
        <h1 className="text-[20px] sm:text-[23px] font-bold leading-[1.28] tracking-[-0.025em] text-zinc-950">
          <span className="block text-[14.5px] sm:text-[15.5px] font-normal text-zinc-700 leading-[1.5] mb-2 tracking-[-0.005em]">
            {quiz.intro}
          </span>
          {quiz.question}
        </h1>

        {/* Options — compact cards */}
        <div className="flex flex-col gap-2">
          {quiz.options.map((opt) => {
            const isSelected = selected === opt.id;
            const isCorrectOption = opt.id === quiz.correctId;
            const showAsCorrect = selected !== null && isCorrectOption;
            const showAsWrong = isSelected && !isCorrectOption;
            const isMuted =
              selected !== null && !isSelected && !isCorrectOption;

            const shakeAnimation = showAsWrong
              ? { x: [0, -4, 4, -3, 3, 0] }
              : undefined;

            return (
              <motion.button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                disabled={selected !== null}
                whileTap={selected === null ? { scale: 0.99 } : undefined}
                animate={shakeAnimation ? shakeAnimation : undefined}
                transition={shakeAnimation ? { duration: 0.35 } : undefined}
                className={`group relative w-full text-left flex items-start gap-2.5 px-3.5 py-3 rounded-[14px] border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 ${
                  showAsCorrect
                    ? "bg-emerald-50 border-emerald-200"
                    : showAsWrong
                      ? "bg-rose-50 border-rose-200"
                      : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                } ${isMuted ? "opacity-[0.55]" : ""}`}
              >
                {/* Letra A/B/C em quadrado discreto */}
                <span
                  className={`flex-shrink-0 w-[22px] h-[22px] rounded-md flex items-center justify-center text-[12px] font-semibold transition-all mt-[1px] ${
                    showAsCorrect
                      ? "bg-emerald-600 text-white"
                      : showAsWrong
                        ? "bg-rose-600 text-white"
                        : "bg-zinc-100 text-zinc-600"
                  }`}
                  aria-hidden="true"
                >
                  {opt.id.toUpperCase()}
                </span>

                {/* Texto */}
                <span className="flex-1 text-[13.5px] sm:text-[14.5px] font-medium leading-[1.45] text-zinc-950 tracking-[-0.005em]">
                  {opt.label}
                </span>

                {/* Ícone check/X */}
                {(showAsCorrect || showAsWrong) && (
                  <span
                    className={`flex-shrink-0 w-5 h-5 mt-[1px] ${
                      showAsCorrect ? "text-emerald-600" : "text-rose-600"
                    }`}
                    aria-hidden="true"
                  >
                    {showAsCorrect ? (
                      <Check className="w-5 h-5" strokeWidth={2.2} />
                    ) : (
                      <X className="w-5 h-5" strokeWidth={2.2} />
                    )}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Feedback inline — soft, sem stripe */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26 }}
              className={`flex items-start gap-2.5 px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl text-[12.5px] sm:text-[13.5px] leading-[1.5] ${
                isCorrect
                  ? "bg-emerald-50 text-emerald-900"
                  : "bg-amber-50 text-amber-900"
              }`}
              role="status"
              aria-live="polite"
            >
              <span
                className={`flex-shrink-0 w-[18px] h-[18px] mt-[1px] ${
                  isCorrect ? "text-emerald-600" : "text-amber-600"
                }`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" />
                  {isCorrect ? (
                    <path
                      d="m8 12 3 3 5-6"
                      stroke="white"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ) : (
                    <>
                      <path
                        d="M12 8v5"
                        stroke="white"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                      <circle cx="12" cy="16.5" r="1.1" fill="white" />
                    </>
                  )}
                </svg>
              </span>
              <div>{feedback}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* CTA sticky bottom */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent border-t border-zinc-100 px-4 pt-2.5 z-20"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-md mx-auto">
          <AnimatePresence mode="wait">
            <motion.button
              key={selected ? "answered" : "empty"}
              type="button"
              onClick={async () => {
                if (selected === null || continuing) return;
                setContinuing(true);
                try {
                  await onContinue();
                } finally {
                  setContinuing(false);
                }
              }}
              disabled={selected === null || continuing}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              whileTap={selected !== null && !continuing ? { scale: 0.99 } : undefined}
              className={`w-full flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-[14px] text-[14px] font-semibold tracking-[-0.005em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 ${
                selected === null
                  ? "bg-zinc-300 text-white cursor-not-allowed"
                  : "bg-violet-700 text-white hover:bg-violet-800"
              }`}
            >
              {selected === null
                ? "Confirmar resposta"
                : continuing
                  ? "Continuando…"
                  : "Continuar"}
              {selected !== null && !continuing && <ArrowRight className="w-4 h-4" />}
            </motion.button>
          </AnimatePresence>
        </div>
      </footer>
    </div>
  );
};
