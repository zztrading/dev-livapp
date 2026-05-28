/**
 * Tela 6 (UAU 2) — SWOT do MEU Momento.
 * 3 chips em sequência (momento + desafio + meta) montam um prompt
 * profissional. Universal — não depende do filtro Visual/Escrita.
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

const STEP_META: Record<1 | 2 | 3, { eyebrow: string; question: string }> = {
  1: { eyebrow: "Passo 1 · Momento", question: "Seu momento atual…" },
  2: { eyebrow: "Passo 2 · Desafio", question: "Maior desafio hoje…" },
  3: { eyebrow: "Passo 3 · Meta", question: "Em 6 meses quero…" },
};

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

  useEffect(
    () => () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    },
    [],
  );

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
        colors: ["#6D28D9", "#8B5CF6", "#fbbf24", "#f59e0b"],
        scalar: 0.9,
      });
    }, 400);
  }, []);

  const promptText = moment && challenge && goal ? buildPrompt(moment, challenge, goal) : "";

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
      const ta = document.createElement("textarea");
      ta.value = promptText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) setCopied(true);
      else setCopyFailed(true);
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
      {options.map((opt) => {
        const isPicked = selected?.id === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPick(opt)}
            className={`group relative w-full text-left flex items-start gap-2.5 px-3.5 py-3 rounded-[14px] border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 active:scale-[0.99] ${
              isPicked
                ? "bg-violet-50 border-violet-300"
                : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <span
              className="flex-shrink-0 text-[20px] leading-none mt-[1px]"
              aria-hidden="true"
            >
              {opt.emoji}
            </span>
            <span className="flex-1 text-[13.5px] sm:text-[14.5px] font-medium leading-[1.45] text-zinc-950 tracking-[-0.005em]">
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white pt-24">
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32 max-w-md w-full mx-auto flex flex-col gap-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-violet-700">
          {stepLabel}
        </span>

        <h1 className="text-[20px] sm:text-[23px] font-bold leading-[1.28] tracking-[-0.025em] text-zinc-950">
          <span className="block text-[14.5px] sm:text-[15.5px] font-normal text-zinc-700 leading-[1.5] mb-2 tracking-[-0.005em]">
            Construa sua primeira análise estratégica.
          </span>
          Vou fazer a IA olhar pra você de forma honesta. Em 3 cliques.
        </h1>

        {/* Progress dos 3 chips */}
        <div className="flex items-center justify-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-[3px] rounded-full transition-all duration-300 ${
                step > s
                  ? "w-[18px] bg-violet-400"
                  : step === s
                    ? "w-6 bg-violet-700"
                    : "w-[18px] bg-zinc-200"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step !== 4 && (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-white border border-zinc-200 rounded-[18px] p-3.5 flex flex-col gap-3"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-violet-700">
                  {STEP_META[step].eyebrow}
                </span>
                <span className="w-[22px] h-[22px] rounded-md bg-violet-50 text-violet-700 text-[12px] font-bold flex items-center justify-center">
                  {step}
                </span>
              </div>
              <p className="text-[14.5px] font-semibold tracking-[-0.015em] text-zinc-950">
                {STEP_META[step].question}
              </p>
              {step === 1 && renderChips(MOMENTS, handleMoment, moment)}
              {step === 2 && renderChips(CHALLENGES, handleChallenge, challenge)}
              {step === 3 && renderChips(GOALS, handleGoal, goal)}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="final"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative rounded-[18px] p-4 text-white overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)",
              }}
            >
              <div
                className="absolute -top-1/2 -right-1/5 w-[200px] h-[200px] rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.15), transparent)",
                }}
                aria-hidden="true"
              />

              <div className="absolute top-3.5 right-3.5 flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold tracking-[0.06em] shadow-[0_4px_12px_-2px_rgba(251,146,60,0.5)]">
                <Sparkles className="w-3 h-3" aria-hidden="true" /> PRO
              </div>

              <p className="text-[10px] font-bold uppercase tracking-[0.08em] opacity-80 mb-3">
                Seu primeiro prompt profissional
              </p>

              <pre className="text-[12.5px] sm:text-[13px] font-medium leading-[1.55] whitespace-pre-wrap font-sans mb-3 max-h-[280px] overflow-y-auto">
                {promptText}
              </pre>

              <button
                type="button"
                onClick={handleCopy}
                aria-live="polite"
                className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white/[0.16] backdrop-blur-md text-[13px] font-semibold hover:bg-white/[0.24] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Copiado!
                  </>
                ) : copyFailed ? (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Toque longo no texto pra copiar
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar prompt
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* CTA sticky bottom — só aparece quando completou os 3 passos */}
      <AnimatePresence>
        {step === 4 && (
          <motion.footer
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent border-t border-zinc-100 px-4 pt-2.5 z-20"
            style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
          >
            <div className="max-w-md mx-auto">
              <button
                type="button"
                onClick={handleContinue}
                disabled={continuing}
                className="w-full flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-[14px] bg-violet-700 text-white text-[14px] font-semibold tracking-[-0.005em] hover:bg-violet-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 active:scale-[0.99]"
              >
                {continuing ? "Continuando…" : "Continuar"}
                {!continuing && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
};
