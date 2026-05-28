import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Heart, Sparkles, Trophy, ArrowRight } from "lucide-react";
import type { QuizMistake } from "./useMiniExperience";
import { QUIZZES } from "./quizData";

interface MistakeReviewScreenProps {
  stepLabel: string;
  mistakes: QuizMistake[];
  onComplete: (data: { attempted: boolean; recovered: number; sparks: number }) => Promise<void> | void;
}

type Mode = "intro" | "retry" | "reward";

// Hints suaves por quiz (referenciam o erro sem humilhar)
const HINTS: Record<QuizMistake["key"], string> = {
  input: "o erro foi achar que a IA adivinha o contexto sozinha.",
  persona: "o erro foi não dar especificidade — IA precisa de detalhes pra mudar o tom.",
  context: "o erro foi dar informação solta, sem estrutura. Organize: Contexto + Entregue.",
  critique: "o erro foi pedir melhoria vaga. Você precisa dirigir o que a IA deve criticar.",
};

const QUIZ_BY_KEY = Object.fromEntries(QUIZZES.map((q) => [q.key, q]));

// Spec v2 (linhas 921-936):
//   Caso A (errou 1+): +5 Sparks pelo esforço
//   Caso B (0 erros):  +10 Sparks Bônus de Mestre
const SPARKS_CASE_A = 5;
const SPARKS_CASE_B = 10;

/**
 * Sub-tela 9/10 do Desafio — Mistake Review.
 *
 * Spec onboarding v2 (linhas 836-940). 2 fluxos:
 *
 * Caso A — Aluno errou pelo menos 1 pergunta:
 *   1. intro: "Você perdeu X Vidas. Quer recuperar?" + [BORA REVISAR]
 *   2. retry (uma pergunta por vez): pergunta + hint + opções
 *      - Acertou: anima ❤️ recovery + feedback positivo + avança auto
 *      - Errou de novo: mensagem "Tudo bem..." + avança auto (não pune duplo)
 *   3. reward: +Vidas recuperadas + 5 Sparks + explainer Vidas + Sparks
 *
 * Caso B — Aluno acertou TUDO (0 erros):
 *   Skip retry, vai direto pra reward: 0 Vidas (já intactas) + 10 Sparks Bônus
 *   de Mestre + explainer só Sparks
 */
export const MistakeReviewScreen = ({
  stepLabel,
  mistakes,
  onComplete,
}: MistakeReviewScreenProps) => {
  const hasMistakes = mistakes.length > 0;
  const [mode, setMode] = useState<Mode>(hasMistakes ? "intro" : "reward");
  const [retryIndex, setRetryIndex] = useState(0);
  const [recovered, setRecovered] = useState(0);
  const [retryFeedback, setRetryFeedback] = useState<
    "correct" | "incorrect" | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryStarted, setRetryStarted] = useState(false);

  // Caso B: já entra no reward. Persiste analytics ao montar.
  // Caso A: persiste ao chegar no reward.
  const handleReward = async () => {
    if (submitting) return;
    setSubmitting(true);
    const sparks = hasMistakes ? SPARKS_CASE_A : SPARKS_CASE_B;
    await onComplete({
      attempted: hasMistakes,
      recovered,
      sparks,
    });
  };

  const startRetry = () => {
    if (retryStarted) return;
    setRetryStarted(true);
    setMode("retry");
  };

  const handleRetryAnswer = (chosenId: string) => {
    if (retryFeedback !== null) return; // anti double-click
    const quiz = QUIZ_BY_KEY[mistakes[retryIndex].key];
    const isCorrect = chosenId === quiz.correctId;
    setRetryFeedback(isCorrect ? "correct" : "incorrect");
    if (isCorrect) setRecovered((prev) => prev + 1);

    // Avança auto após mostrar feedback
    setTimeout(
      () => {
        setRetryFeedback(null);
        if (retryIndex + 1 >= mistakes.length) {
          setMode("reward");
        } else {
          setRetryIndex((prev) => prev + 1);
        }
      },
      isCorrect ? 1200 : 1800,
    );
  };

  // ────────────────────────────────────────────────────
  // INTRO (Caso A apenas)
  // ────────────────────────────────────────────────────
  if (mode === "intro") {
    return (
      <div className="min-h-screen flex flex-col bg-white pt-24">
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32 max-w-md w-full mx-auto flex flex-col gap-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-violet-700">
            {stepLabel}
          </span>

          <h1 className="text-[20px] sm:text-[23px] font-bold leading-[1.28] tracking-[-0.025em] text-zinc-950">
            <span className="block text-[14.5px] sm:text-[15.5px] font-normal text-zinc-700 leading-[1.5] mb-2 tracking-[-0.005em]">
              Você perdeu {mistakes.length} Vida{mistakes.length > 1 ? "s" : ""} no desafio.
            </span>
            Quer recuperar?
          </h1>

          <div
            className="text-center text-[28px] tracking-[2px] mt-1"
            aria-hidden="true"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i}>{i < 5 - mistakes.length ? "❤️" : "🤍"}</span>
            ))}
          </div>

          <div className="rounded-[14px] border border-violet-200 bg-violet-50 p-3.5 mt-1">
            <p className="text-[13px] font-bold text-violet-900 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Como funciona
            </p>
            <p className="text-[12.5px] text-violet-900/85 leading-[1.5]">
              Refaça as {mistakes.length} questões que errou. Se acertar →
              recupera as Vidas + ganha Sparks pelo esforço.
            </p>
          </div>
        </main>

        <motion.footer
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent border-t border-zinc-100 px-4 pt-2.5 z-20"
          style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
        >
          <div className="max-w-md mx-auto flex flex-col gap-2">
            <button
              type="button"
              onClick={startRetry}
              disabled={retryStarted || submitting}
              className="w-full flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-[14px] bg-violet-700 text-white text-[14px] font-semibold tracking-[-0.005em] hover:bg-violet-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 active:scale-[0.99]"
            >
              Bora revisar
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (submitting || retryStarted) return;
                setSubmitting(true);
                await onComplete({ attempted: true, recovered: 0, sparks: 0 });
              }}
              disabled={submitting || retryStarted}
              className="w-full py-2 text-[12.5px] font-medium text-zinc-500 hover:text-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-lg"
            >
              Pular essa revisão
            </button>
          </div>
        </motion.footer>
      </div>
    );
  }

  // ────────────────────────────────────────────────────
  // RETRY (Caso A apenas)
  // ────────────────────────────────────────────────────
  if (mode === "retry") {
    const current = mistakes[retryIndex];
    const quiz = QUIZ_BY_KEY[current.key];

    return (
      <motion.div
        key={`retry-${retryIndex}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen flex flex-col bg-white pt-24"
      >
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32 max-w-md w-full mx-auto flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-violet-700">
              {stepLabel}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
              Revisão {retryIndex + 1}/{mistakes.length}
            </span>
          </div>

          <h1 className="text-[20px] sm:text-[23px] font-bold leading-[1.28] tracking-[-0.025em] text-zinc-950">
            <span className="block text-[14.5px] sm:text-[15.5px] font-normal text-zinc-700 leading-[1.5] mb-2 tracking-[-0.005em]">
              {quiz.intro}
            </span>
            {quiz.question}
          </h1>

          <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
            <span className="text-[14px] leading-none mt-[1px]" aria-hidden="true">
              💡
            </span>
            <p className="text-[12.5px] text-amber-900 leading-[1.5]">
              <strong className="font-bold">Hint:</strong> {HINTS[current.key]}
            </p>
          </div>

          <div className="flex flex-col gap-2 mt-1">
            {quiz.options.map((opt) => {
              const isCorrectOpt = retryFeedback && opt.id === quiz.correctId;
              const disabled = retryFeedback !== null;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleRetryAnswer(opt.id)}
                  disabled={disabled}
                  className={`w-full text-left flex items-start gap-3 px-3.5 py-3 rounded-[14px] border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 active:scale-[0.99] ${
                    isCorrectOpt
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                  } ${disabled && !isCorrectOpt ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    className={`flex-shrink-0 inline-flex items-center justify-center w-[22px] h-[22px] rounded-md text-[11px] font-bold mt-[1px] ${
                      isCorrectOpt
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                    aria-hidden="true"
                  >
                    {opt.id.toUpperCase()}
                  </span>
                  <span className="text-[13.5px] font-medium text-zinc-900 leading-[1.45]">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {retryFeedback === "correct" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26 }}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-900 text-[12.5px] leading-[1.5]"
                role="status"
                aria-live="polite"
              >
                <span
                  className="flex-shrink-0 text-[16px] leading-none mt-[1px]"
                  aria-hidden="true"
                >
                  🤍 → ❤️
                </span>
                <div>
                  <strong className="font-bold">Boa.</strong> Vida recuperada.
                </div>
              </motion.div>
            )}
            {retryFeedback === "incorrect" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26 }}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-zinc-100 text-zinc-700 text-[12.5px] leading-[1.5]"
                role="status"
                aria-live="polite"
              >
                <div>
                  Tudo bem. Esse conceito a gente revisa na primeira aula.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </motion.div>
    );
  }

  // ────────────────────────────────────────────────────
  // REWARD (Caso A e Caso B)
  // ────────────────────────────────────────────────────
  const sparksToShow = hasMistakes ? SPARKS_CASE_A : SPARKS_CASE_B;

  // Caso B — preserva exatamente o render anexado (Trophy + "Você não errou nenhuma!")
  if (!hasMistakes) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="min-h-screen flex flex-col px-5 sm:px-6 pt-24 pb-10 max-w-md mx-auto"
      >
        <p className="text-xs uppercase tracking-wider text-slate-400 mb-6 text-center">
          {stepLabel}
        </p>

        <div className="flex-1 flex flex-col justify-center gap-6">
          <div className="text-center">
            <Trophy
              className="w-12 h-12 text-amber-500 mx-auto mb-3"
              aria-hidden="true"
            />
            <h2 className="text-2xl font-bold text-slate-900">
              Você não errou nenhuma!
            </h2>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-center gap-1 text-2xl" aria-hidden="true">
              ❤️❤️❤️❤️❤️
            </div>
            <p className="text-center text-emerald-900 font-semibold">
              Vidas intactas
            </p>
            <p className="text-center text-amber-700 font-bold flex items-center justify-center gap-1.5">
              <Sparkles className="w-5 h-5" /> +{sparksToShow} Sparks Bônus de
              Mestre
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-3">
            <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              💡 O que é isso?
            </p>
            <p className="text-xs text-slate-600 leading-relaxed flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Sparks</strong> você troca na Loja por bônus (XP boost,
                ferramentas extras, personalização).
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReward}
          disabled={submitting}
          className="w-full mt-8 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-2xl shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {submitting ? "Salvando..." : "Continuar"}
        </button>
      </motion.section>
    );
  }

  // Caso A — reward redesenhado no padrão do mockup
  return (
    <div className="min-h-screen flex flex-col bg-white pt-24">
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32 max-w-md w-full mx-auto flex flex-col gap-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-violet-700">
          {stepLabel}
        </span>

        <h1 className="text-[20px] sm:text-[23px] font-bold leading-[1.28] tracking-[-0.025em] text-zinc-950">
          <span className="block text-[14.5px] sm:text-[15.5px] font-normal text-zinc-700 leading-[1.5] mb-2 tracking-[-0.005em]">
            Revisão completa.
          </span>
          Olha o que você ganhou.
        </h1>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, type: "spring", stiffness: 180 }}
          className="rounded-[14px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 flex flex-col gap-3"
        >
          <div
            className="text-center text-[26px] tracking-[2px]"
            aria-hidden="true"
          >
            {Array.from({ length: 5 })
              .map((_, i) =>
                i < 5 - mistakes.length + recovered ? "❤️" : "🤍",
              )
              .join("")}
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[13.5px] font-bold text-emerald-900">
            <Heart className="w-4 h-4 fill-emerald-700 text-emerald-700" />
            +{recovered} Vida{recovered === 1 ? "" : "s"} recuperada
            {recovered === 1 ? "" : "s"}
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[13.5px] font-bold text-amber-700">
            <Sparkles className="w-4 h-4" />
            +{sparksToShow} Sparks pelo esforço
          </div>
        </motion.div>

        <div className="rounded-[14px] border border-zinc-200 bg-zinc-50 p-3.5 flex flex-col gap-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">
            O que é isso
          </p>
          <p className="text-[12.5px] text-zinc-700 leading-[1.5] flex items-start gap-2">
            <Heart className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="font-bold text-zinc-900">Vidas</strong> são
              suas tentativas. Quando acaba, espera 3h ou usa Sparks pra repor
              na hora.
            </span>
          </p>
          <p className="text-[12.5px] text-zinc-700 leading-[1.5] flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="font-bold text-zinc-900">Sparks</strong> você
              troca na Loja por bônus (XP boost, ferramentas extras,
              personalização).
            </span>
          </p>
        </div>
      </main>

      <motion.footer
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent border-t border-zinc-100 px-4 pt-2.5 z-20"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={handleReward}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-[14px] bg-violet-700 text-white text-[14px] font-semibold tracking-[-0.005em] hover:bg-violet-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 active:scale-[0.99]"
          >
            {submitting ? "Salvando…" : "Continuar"}
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </motion.footer>
    </div>
  );
};
