/**
 * Tela 6 (UAU 2) — SWOT do MEU Momento.
 * 3 chips em sequência (momento + desafio + meta) montam um prompt
 * profissional. Universal — não depende do filtro Visual/Escrita.
 * Inspirado no GuidedPlayground.tsx da V5.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Copy, Check, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";

interface UauTwoSwotScreenProps {
  stepLabel: string;
  onComplete: (data: {
    moment: string;
    challenge: string;
    goal: string;
    promptBuilt: string;
  }) => Promise<void>;
}

interface ChipOption {
  id: string;
  label: string;
  emoji: string;
  /** Texto que entra no prompt (sem o emoji) */
  promptTerm: string;
}

const MOMENTS: ChipOption[] = [
  { id: "stable", emoji: "💼", label: "Trabalho estável, buscando crescer", promptTerm: "Profissional empregado em busca de crescimento" },
  { id: "transition", emoji: "🔄", label: "Em transição (entre trabalhos ou áreas)", promptTerm: "Profissional em transição de carreira" },
  { id: "building", emoji: "🚀", label: "Construindo algo próprio", promptTerm: "Empreendedor construindo o próprio negócio" },
  { id: "thinking", emoji: "🤔", label: "Pensando em mudar mas sem clareza", promptTerm: "Pessoa avaliando mudança sem clareza definida" },
];

const CHALLENGES: ChipOption[] = [
  { id: "money", emoji: "💰", label: "Financeiro", promptTerm: "pressão financeira" },
  { id: "time", emoji: "⏱", label: "Tempo escasso", promptTerm: "tempo escasso" },
  { id: "clarity", emoji: "🧠", label: "Falta de clareza", promptTerm: "falta de clareza estratégica" },
  { id: "energy", emoji: "💪", label: "Saúde / energia", promptTerm: "saúde e energia limitadas" },
];

const GOALS: ChipOption[] = [
  { id: "income", emoji: "💸", label: "Mais renda", promptTerm: "aumento de renda" },
  { id: "balance", emoji: "⚖️", label: "Mais equilíbrio", promptTerm: "mais equilíbrio entre vida e trabalho" },
  { id: "newchapter", emoji: "🚀", label: "Novo capítulo", promptTerm: "novo capítulo profissional" },
  { id: "health", emoji: "💪", label: "Mais saúde", promptTerm: "melhoria de saúde e energia" },
];

function buildPrompt(moment: ChipOption, challenge: ChipOption, goal: ChipOption): string {
  return `Aja como coach executivo sênior, especialista em análise estratégica de vida e carreira.

Faça uma análise SWOT honesta e construtiva pra:

${moment.promptTerm}, enfrentando ${challenge.promptTerm}, querendo ${goal.promptTerm} em 6 meses.

Entregue:
• Forças (3 que vou potencializar)
• Fraquezas (3 que vou mitigar com plano de ação)
• Oportunidades (3 que vou capturar com prioridade)
• Ameaças (3 que vou neutralizar antes que virem problema)
• Plano de 30/60/90 dias com 1 ação concreta por semana
• 3 sinais de que estou no caminho certo`;
}

type Step = 1 | 2 | 3 | 4;

export const UauTwoSwotScreen = ({
  stepLabel,
  onComplete,
}: UauTwoSwotScreenProps) => {
  const [step, setStep] = useState<Step>(1);
  const [moment, setMoment] = useState<ChipOption | null>(null);
  const [challenge, setChallenge] = useState<ChipOption | null>(null);
  const [goal, setGoal] = useState<ChipOption | null>(null);
  const [copied, setCopied] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup do timer em unmount (fix #11)
  useEffect(
    () => () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    },
    [],
  );

  // Permite trocar a escolha antes do auto-advance — limpa timer pendente e reinicia (fix #7)
  const handleMoment = useCallback((opt: ChipOption) => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    setMoment(opt);
    stepTimerRef.current = setTimeout(() => setStep(2), 400);
  }, []);

  const handleChallenge = useCallback((opt: ChipOption) => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    setChallenge(opt);
    stepTimerRef.current = setTimeout(() => setStep(3), 400);
  }, []);

  const handleGoal = useCallback((opt: ChipOption) => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    setGoal(opt);
    stepTimerRef.current = setTimeout(() => {
      setStep(4);
      confetti({
        particleCount: 70,
        spread: 90,
        origin: { y: 0.5 },
        colors: ["#6366f1", "#8b5cf6", "#fbbf24", "#f59e0b"],
        scalar: 0.9,
      });
    }, 400);
  }, []);

  const promptText = moment && challenge && goal ? buildPrompt(moment, challenge, goal) : "";

  // Copia com fallback pra iOS/contextos sem HTTPS — feedback de erro também (fix #8)
  const handleCopy = useCallback(async () => {
    if (!promptText) return;
    const reset = () => {
      setTimeout(() => {
        setCopied(false);
        setCopyFailed(false);
      }, 2200);
    };
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptText);
        setCopied(true);
        reset();
        return;
      }
      // Fallback execCommand (iOS antigos / contextos não-seguros)
      const ta = document.createElement("textarea");
      ta.value = promptText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) {
        setCopied(true);
      } else {
        setCopyFailed(true);
      }
      reset();
    } catch {
      setCopyFailed(true);
      reset();
    }
  }, [promptText]);

  const handleContinue = useCallback(async () => {
    if (continuing || !moment || !challenge || !goal) return;
    setContinuing(true);
    try {
      await onComplete({
        moment: moment.id,
        challenge: challenge.id,
        goal: goal.id,
        promptBuilt: promptText,
      });
    } finally {
      setContinuing(false);
    }
  }, [continuing, moment, challenge, goal, promptText, onComplete]);

  const renderChips = (
    options: ChipOption[],
    onPick: (opt: ChipOption) => void,
    selected: ChipOption | null,
  ) => (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <motion.button
          key={opt.id}
          type="button"
          onClick={() => onPick(opt)}
          whileTap={{ scale: 0.98 }}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
            selected?.id === opt.id
              ? "border-indigo-500 bg-indigo-50"
              : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"
          }`}
        >
          <span className="text-2xl flex-shrink-0" aria-hidden="true">
            {opt.emoji}
          </span>
          <span className="text-sm sm:text-base font-semibold text-slate-800 leading-snug">
            {opt.label}
          </span>
        </motion.button>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen flex flex-col px-5 sm:px-6 pt-16 pb-10"
    >
      <div className="max-w-md w-full mx-auto flex flex-col flex-1">
        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
          {stepLabel}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug mb-2">
          Construa sua primeira análise estratégica.
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Vou fazer a IA olhar pra você de forma honesta. Em 3 cliques.
        </p>

        {/* Progress dos 3 chips */}
        <div className="flex items-center gap-1.5 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step > s ? "bg-emerald-400" : step === s ? "bg-indigo-500" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3 }}
              className="flex-1"
            >
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                Seu momento atual…
              </p>
              {renderChips(MOMENTS, handleMoment, moment)}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3 }}
              className="flex-1"
            >
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                Maior desafio hoje…
              </p>
              {renderChips(CHALLENGES, handleChallenge, challenge)}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3 }}
              className="flex-1"
            >
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                Em 6 meses quero…
              </p>
              {renderChips(GOALS, handleGoal, goal)}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-4"
            >
              <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 shadow-md shadow-amber-200/50">
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Seu primeiro prompt profissional
                </p>
                <pre className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                  {promptText}
                </pre>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                aria-live="polite"
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                  copied
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : copyFailed
                      ? "border-amber-400 bg-amber-50 text-amber-800"
                      : "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copiado!
                  </>
                ) : copyFailed ? (
                  <>
                    <Copy className="w-4 h-4" />
                    Toque longo no texto pra copiar
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar prompt
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleContinue}
                disabled={continuing}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-lg shadow-indigo-500/25 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
