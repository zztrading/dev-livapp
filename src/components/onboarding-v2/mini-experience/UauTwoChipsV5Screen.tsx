import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface UauTwoChipsV5ScreenProps {
  stepLabel: string;
  onComplete: () => Promise<void> | void;
}

type Category = "verb" | "who" | "tone" | "intent";

interface Chip {
  value: string;
  emoji: string;
  promptTerm: string;
}

const CHIPS: Record<Category, { label: string; chips: Chip[] }> = {
  verb: {
    label: "VERBO",
    chips: [
      { emoji: "📊", value: "Plano", promptTerm: "Plano" },
      { emoji: "📝", value: "Resumo", promptTerm: "Resumo" },
      { emoji: "💡", value: "Análise", promptTerm: "Análise" },
      { emoji: "🎯", value: "Roteiro", promptTerm: "Roteiro" },
      { emoji: "⚡", value: "Estratégia", promptTerm: "Estratégia" },
      { emoji: "📈", value: "Relatório", promptTerm: "Relatório" },
    ],
  },
  who: {
    label: "PARA QUEM",
    chips: [
      { emoji: "👤", value: "Cliente", promptTerm: "um cliente" },
      { emoji: "🏠", value: "Família", promptTerm: "minha família" },
      { emoji: "🎓", value: "Curso/estudo", promptTerm: "meus estudos" },
      { emoji: "🪞", value: "Mim mesmo", promptTerm: "mim mesmo" },
      { emoji: "👥", value: "Time", promptTerm: "meu time" },
      { emoji: "🌍", value: "Público", promptTerm: "o público em geral" },
    ],
  },
  tone: {
    label: "TOM",
    chips: [
      { emoji: "🎩", value: "Profissional", promptTerm: "profissional" },
      { emoji: "😊", value: "Amigável", promptTerm: "amigável" },
      { emoji: "⚡", value: "Direto", promptTerm: "direto" },
      { emoji: "🚀", value: "Empolgado", promptTerm: "empolgado" },
      { emoji: "🧘", value: "Calmo", promptTerm: "calmo" },
      { emoji: "🎯", value: "Decisivo", promptTerm: "decisivo" },
    ],
  },
  intent: {
    label: "INTENÇÃO",
    chips: [
      { emoji: "💰", value: "Vender mais", promptTerm: "vender mais" },
      { emoji: "🎯", value: "Convencer", promptTerm: "convencer alguém" },
      { emoji: "🧠", value: "Informar", promptTerm: "informar com clareza" },
      { emoji: "💪", value: "Inspirar ação", promptTerm: "inspirar à ação" },
      { emoji: "⚖️", value: "Ajudar a decidir", promptTerm: "ajudar a decidir" },
      { emoji: "🌟", value: "Inovar", promptTerm: "inovar" },
    ],
  },
};

const CATEGORY_ORDER: Category[] = ["verb", "who", "tone", "intent"];

const CATEGORY_META: Record<Category, { step: number; question: string }> = {
  verb: { step: 1, question: "O que você quer criar?" },
  who: { step: 2, question: "Para quem é?" },
  tone: { step: 3, question: "Qual o tom?" },
  intent: { step: 4, question: "Qual a intenção?" },
};

export const UauTwoChipsV5Screen = ({
  stepLabel,
  onComplete,
}: UauTwoChipsV5ScreenProps) => {
  const [selected, setSelected] = useState<Record<Category, Chip | null>>({
    verb: null,
    who: null,
    tone: null,
    intent: null,
  });
  const [openCategory, setOpenCategory] = useState<Category | null>("verb");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const filledCount = CATEGORY_ORDER.filter((cat) => selected[cat] !== null)
    .length;
  const allFilled = filledCount === CATEGORY_ORDER.length;

  const handleChipPick = (cat: Category, chip: Chip) => {
    const newSelected = { ...selected, [cat]: chip };
    setSelected(newSelected);
    const nextEmpty = CATEGORY_ORDER.find(
      (c) => c !== cat && newSelected[c] === null,
    );
    if (nextEmpty) {
      setTimeout(() => setOpenCategory(nextEmpty), 260);
    } else {
      setOpenCategory(null);
    }
  };

  const builtPrompt = allFilled
    ? `Quero um ${selected.verb!.promptTerm} para ${selected.who!.promptTerm}, com tom ${selected.tone!.promptTerm}, focado em ${selected.intent!.promptTerm}.`
    : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(builtPrompt);
      setCopied(true);
      toast.success("Prompt copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto manualmente.");
    }
  };

  const handleContinue = async () => {
    if (submitting) return;
    setSubmitting(true);
    await onComplete();
  };

  const renderSlot = (cat: Category) => {
    const chip = selected[cat];
    const isOpen = openCategory === cat;
    return (
      <button
        type="button"
        onClick={() => setOpenCategory(cat)}
        className={`inline-flex items-center gap-1 mx-0.5 px-2.5 py-[3px] rounded-full text-[12px] font-semibold align-middle whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
          chip
            ? "border-[1.5px] border-violet-700 bg-white text-zinc-950"
            : isOpen
              ? "border-[1.5px] border-violet-700 bg-violet-50 text-violet-700 shadow-[0_0_0_4px_rgba(109,40,217,0.08)]"
              : "border-[1.5px] border-dashed border-zinc-300 bg-white text-zinc-400 hover:border-zinc-400"
        }`}
      >
        {chip && (
          <span className="text-[14px] leading-none" aria-hidden="true">
            {chip.emoji}
          </span>
        )}
        <span>{chip?.value ?? `[${CHIPS[cat].label}]`}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-white pt-24">
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32 max-w-md w-full mx-auto flex flex-col gap-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-violet-700">
          {stepLabel}
        </span>

        <div>
          <h1 className="text-[20px] sm:text-[23px] font-bold leading-[1.2] tracking-[-0.025em] text-zinc-950 mb-1">
            Construa seu primeiro prompt{" "}
            <span className="text-violet-700">PRO</span>.
          </h1>
          <p className="text-[13px] text-zinc-600 leading-[1.45]">
            Toque em cada lacuna e escolha um chip.
          </p>
        </div>

        {/* Prompt builder card */}
        <div className="bg-white border border-zinc-200 rounded-[18px] p-3.5">
          <p className="text-[15px] sm:text-[17px] font-medium leading-[1.65] sm:leading-[1.7] tracking-[-0.01em] text-zinc-950">
            Quero um {renderSlot("verb")} para {renderSlot("who")}, com tom{" "}
            {renderSlot("tone")}, pra {renderSlot("intent")}.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 -mb-0.5">
          {CATEGORY_ORDER.map((cat) => {
            const isActive = openCategory === cat;
            const isDone = selected[cat] !== null;
            return (
              <div
                key={cat}
                className={`h-[3px] rounded-full transition-all duration-300 ${
                  isActive
                    ? "w-6 bg-violet-700"
                    : isDone
                      ? "w-[18px] bg-violet-400"
                      : "w-[18px] bg-zinc-200"
                }`}
              />
            );
          })}
        </div>

        {/* Step card / Prompt final */}
        <AnimatePresence mode="wait">
          {!allFilled && openCategory && (
            <motion.div
              key={openCategory}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22 }}
              className="bg-white border border-zinc-200 rounded-[18px] p-3.5"
            >
              <div className="flex items-baseline justify-between mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-violet-700">
                  Passo {CATEGORY_META[openCategory].step} ·{" "}
                  {CHIPS[openCategory].label}
                </span>
                <span className="w-[22px] h-[22px] rounded-md bg-violet-50 text-violet-700 text-[12px] font-bold flex items-center justify-center">
                  {CATEGORY_META[openCategory].step}
                </span>
              </div>
              <p className="text-[14.5px] font-semibold tracking-[-0.015em] text-zinc-950 mb-2.5">
                {CATEGORY_META[openCategory].question}
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {CHIPS[openCategory].chips.map((chip) => {
                  const isPicked = selected[openCategory]?.value === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => handleChipPick(openCategory, chip)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] font-medium min-h-[42px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 active:scale-[0.97] ${
                        isPicked
                          ? "border-violet-700 bg-violet-50 text-violet-700"
                          : "border-zinc-200 bg-white text-zinc-950 hover:border-violet-700 hover:bg-violet-50"
                      }`}
                    >
                      <span
                        className="text-[15px] leading-none"
                        aria-hidden="true"
                      >
                        {chip.emoji}
                      </span>
                      <span>{chip.value}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {allFilled && (
            <motion.div
              key="final"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative rounded-[18px] p-4 text-white overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)",
              }}
            >
              {/* Glow decorativo */}
              <div
                className="absolute -top-1/2 -right-1/5 w-[200px] h-[200px] rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.15), transparent)",
                }}
                aria-hidden="true"
              />

              {/* Selo PRO */}
              <div className="absolute top-3.5 right-3.5 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.18] backdrop-blur-md text-[10px] font-bold tracking-[0.06em]">
                <Sparkles className="w-3 h-3" aria-hidden="true" /> PRO
              </div>

              <p className="text-[10px] font-bold uppercase tracking-[0.08em] opacity-80 mb-3">
                Seu primeiro prompt profissional
              </p>

              <p className="text-[14.5px] font-semibold italic leading-[1.5] tracking-[-0.01em] mb-3">
                "{builtPrompt}"
              </p>

              <p className="text-[11.5px] opacity-[0.92] mb-1.5 leading-[1.45]">
                ✨ Você usou a fórmula que profissional de IA cobra{" "}
                <strong className="font-bold">R$ 500/h</strong> pra ensinar:
              </p>

              <div className="flex flex-wrap gap-1 mb-2.5">
                {CATEGORY_ORDER.map((cat) => (
                  <span
                    key={cat}
                    className="text-[11px] font-bold tracking-[0.04em] px-2.5 py-[5px] rounded-full bg-white/[0.16]"
                  >
                    {CHIPS[cat].label}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white/[0.16] backdrop-blur-md text-[13px] font-semibold hover:bg-white/[0.24] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copiar prompt
                  </>
                )}
              </button>
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
          <button
            type="button"
            onClick={handleContinue}
            disabled={!allFilled || submitting}
            className={`w-full flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-[14px] text-[14px] font-semibold tracking-[-0.005em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 active:scale-[0.99] ${
              !allFilled
                ? "bg-zinc-300 text-white cursor-not-allowed"
                : "bg-violet-700 text-white hover:bg-violet-800"
            }`}
          >
            {submitting
              ? "Salvando…"
              : !allFilled
                ? `Preencha ${4 - filledCount} ${4 - filledCount === 1 ? "lacuna" : "lacunas"}`
                : "Continuar"}
            {allFilled && !submitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </footer>
    </div>
  );
};
