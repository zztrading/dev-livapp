import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import type { QuizDefinition } from "./quizData";

interface QuizScreenProps {
  quiz: QuizDefinition;
  /** Texto de cabeçalho — ex: "Mini-experiência · 2 de 7" */
  stepLabel: string;
  /** Cor de destaque do nível (verde fácil → amber médio → red-orange hard) */
  difficulty: "easy" | "medium" | "hard";
  onSubmit: (answer: string, correct: boolean) => Promise<void>;
  /** Chamado quando usuário clica Continuar. Pode ser async — botão fica
   * disabled durante o await pra evitar duplo-clique. */
  onContinue: () => void | Promise<void>;
}

const DIFFICULTY_BADGE: Record<
  QuizScreenProps["difficulty"],
  { label: string; bg: string; text: string }
> = {
  easy: { label: "Fácil", bg: "bg-emerald-100", text: "text-emerald-700" },
  medium: { label: "Médio", bg: "bg-amber-100", text: "text-amber-700" },
  hard: { label: "Hard", bg: "bg-rose-100", text: "text-rose-700" },
};

/**
 * Tela genérica de quiz com:
 *  - intro + pergunta + N opções
 *  - feedback contextual após selecionar
 *  - botão Continuar só aparece após resposta
 *  - confete + scale spring no card correto
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
        // Tier 1 festim: mini-confete no botão correto
        confetti({
          particleCount: 25,
          spread: 60,
          origin: { y: 0.5 },
          colors: ["#6366f1", "#8b5cf6", "#10b981", "#fbbf24"],
          startVelocity: 20,
          gravity: 1.2,
          scalar: 0.7,
        });
      }
      await onSubmit(id, correct);
      setSubmitting(false);
    },
    [selected, submitting, quiz.correctId, onSubmit],
  );

  // Reset state quando troca de quiz
  useEffect(() => {
    setSelected(null);
    setSubmitting(false);
  }, [quiz.key]);

  const badge = DIFFICULTY_BADGE[difficulty];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="min-h-screen flex flex-col px-5 sm:px-6 pt-16 pb-10"
    >
      <div className="max-w-md w-full mx-auto flex flex-col flex-1">
        {/* Header com step + badge de dificuldade */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
            {stepLabel}
          </p>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
        </div>

        <h2 className="text-lg sm:text-xl font-semibold text-slate-700 leading-relaxed mb-2">
          {quiz.intro}
        </h2>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug mb-6">
          {quiz.question}
        </h1>

        {/* Opções */}
        <div className="flex flex-col gap-2.5 flex-1">
          {quiz.options.map((opt, idx) => {
            const isSelected = selected === opt.id;
            const isCorrectOption = opt.id === quiz.correctId;
            const showAsCorrect = selected !== null && isCorrectOption;
            const showAsWrong = isSelected && !isCorrectOption;

            const borderColor =
              showAsCorrect
                ? "border-emerald-400"
                : showAsWrong
                  ? "border-rose-400"
                  : isSelected
                    ? "border-indigo-500"
                    : "border-slate-200 hover:border-indigo-300";
            const bgColor =
              showAsCorrect
                ? "bg-emerald-50"
                : showAsWrong
                  ? "bg-rose-50"
                  : "bg-white hover:bg-indigo-50/30";

            return (
              <motion.button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                disabled={selected !== null}
                initial={{ opacity: 0, x: -12 }}
                animate={
                  showAsCorrect
                    ? { opacity: 1, x: 0, scale: [1, 1.04, 1] }
                    : { opacity: 1, x: 0 }
                }
                transition={
                  showAsCorrect
                    ? { delay: 0.05 * idx, scale: { duration: 0.4 } }
                    : { delay: 0.05 * idx, duration: 0.3 }
                }
                whileTap={selected === null ? { scale: 0.98 } : undefined}
                className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-2xl border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${borderColor} ${bgColor} ${
                  selected !== null && !isSelected && !isCorrectOption
                    ? "opacity-50"
                    : ""
                }`}
              >
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                    showAsCorrect
                      ? "bg-emerald-500 text-white"
                      : showAsWrong
                        ? "bg-rose-500 text-white"
                        : "bg-slate-100 text-slate-600"
                  }`}
                  aria-hidden="true"
                >
                  {showAsCorrect ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : showAsWrong ? (
                    <X className="w-3.5 h-3.5" />
                  ) : (
                    opt.id.toUpperCase()
                  )}
                </span>
                <span className="flex-1 text-sm sm:text-[15px] font-medium text-slate-800 leading-relaxed">
                  {opt.label}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Feedback contextual */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className={`mt-5 p-4 rounded-2xl border ${
                isCorrect
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-amber-50 border-amber-200"
              }`}
              role="status"
              aria-live="polite"
            >
              <p
                className={`text-sm leading-relaxed ${
                  isCorrect ? "text-emerald-900" : "text-amber-900"
                }`}
              >
                {feedback}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA Continuar */}
        <AnimatePresence>
          {selected !== null && (
            <motion.button
              type="button"
              onClick={async () => {
                if (continuing) return;
                setContinuing(true);
                try {
                  await onContinue();
                } finally {
                  // Reset só se ainda montado — proteção light
                  setContinuing(false);
                }
              }}
              disabled={continuing}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.35 }}
              whileTap={!continuing ? { scale: 0.97 } : undefined}
              className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Continuar
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
