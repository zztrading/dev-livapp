import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Quote, Check } from "lucide-react";

interface HookScreenProps {
  selected?: string;
  onSelect: (value: string) => void | Promise<void>;
  onBack?: () => void;
}

type HookValue = "torcer" | "garantir";

interface Option {
  value: HookValue;
  emoji: string;
  title: string;
  subtitle: string;
  /** Cor base do ícone — usado em background do círculo + glow on select */
  accent: "rose" | "indigo";
}

const OPTIONS: Option[] = [
  {
    value: "torcer",
    emoji: "🤞",
    title: "Torcer pra não ser o meu",
    subtitle: "Esperar e ver o que acontece",
    accent: "rose",
  },
  {
    value: "garantir",
    emoji: "🎯",
    title: "Dominar a IA para não ficar para trás",
    subtitle: "Agir agora, não depois",
    accent: "indigo",
  },
];

const FEEDBACK: Record<HookValue, string> = {
  torcer:
    "Honestidade rara. Torcer é o que 90% faz. Você tá aqui, então parte de você sabe que torcer não vai bastar. Vamos.",
  garantir:
    "Boa escolha. Você não está esperando a mudança passar. Está aprendendo a usar a I.A. antes que ela decida o jogo por você.",
};

const ACCENT_STYLES: Record<
  Option["accent"],
  { iconBg: string; iconRing: string; selectedBorder: string; selectedBg: string; selectedShadow: string }
> = {
  rose: {
    iconBg: "bg-gradient-to-br from-rose-100 to-rose-200",
    iconRing: "ring-rose-200/60",
    selectedBorder: "border-rose-400",
    selectedBg: "bg-rose-50/60",
    selectedShadow: "shadow-[0_8px_24px_-8px_rgba(244,63,94,0.25)]",
  },
  indigo: {
    iconBg: "bg-gradient-to-br from-indigo-100 to-violet-200",
    iconRing: "ring-indigo-200/60",
    selectedBorder: "border-indigo-500",
    selectedBg: "bg-indigo-50/60",
    selectedShadow: "shadow-[0_8px_24px_-8px_rgba(99,102,241,0.35)]",
  },
};

export const HookScreen = ({ selected, onSelect, onBack }: HookScreenProps) => {
  const [picked, setPicked] = useState<HookValue | null>(
    (selected as HookValue | undefined) ?? null,
  );
  const [submitting, setSubmitting] = useState(false);

  const handlePick = (value: HookValue) => {
    if (submitting) return;
    setPicked(value);
  };

  const handleContinue = async () => {
    if (!picked || submitting) return;
    setSubmitting(true);
    try {
      await onSelect(picked);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col px-5 sm:px-6 pt-6 pb-8 bg-gradient-to-b from-slate-50 via-white to-slate-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-md w-full mx-auto">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <span className="w-9" aria-hidden="true" />
        )}
      </div>

      {/* Contexto: quem é Dario Amodei */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="max-w-md w-full mx-auto mb-5"
      >
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-2">
          Quem fala
        </p>
        <p className="text-[15px] sm:text-base text-slate-700 leading-relaxed">
          <span className="font-bold text-slate-900">Dario Amodei</span>, CEO da
          <span className="font-bold text-slate-900"> Anthropic</span> — empresa por trás do Claude.
        </p>
      </motion.div>

      {/* Quote — premium card */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="max-w-md w-full mx-auto mb-6 relative"
      >
        {/* Glow decorativo atrás do card */}
        <div
          className="absolute -inset-3 bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-amber-500/15 blur-2xl rounded-3xl"
          aria-hidden="true"
        />

        <blockquote className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white px-5 sm:px-6 py-5 shadow-[0_15px_40px_-12px_rgba(15,23,42,0.5)] overflow-hidden">
          {/* Quote icon decorativo */}
          <Quote
            className="absolute top-3 right-3 w-8 h-8 text-white/10 rotate-180"
            aria-hidden="true"
            fill="currentColor"
          />

          {/* Stripe vertical accent */}
          <div
            className="absolute left-0 top-5 bottom-5 w-1 bg-gradient-to-b from-amber-400 via-amber-500 to-transparent rounded-r-full"
            aria-hidden="true"
          />

          <p className="relative text-[15px] sm:text-base font-medium leading-[1.55] pl-3.5">
            "Nos próximos{" "}
            <span className="font-bold text-amber-300">18 meses</span> a IA pode eliminar{" "}
            <span className="font-extrabold text-amber-300 text-lg tracking-tight">
              METADE
            </span>{" "}
            dos empregos que conhecemos."
          </p>

          <footer className="relative pl-3.5 mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
            <span className="w-1 h-3 bg-amber-400 rounded-full" aria-hidden="true" />
            <span className="text-[10px] uppercase tracking-[0.12em] text-slate-300 font-semibold">
              Dario Amodei <span className="text-slate-500">·</span> CEO Anthropic, 2026
            </span>
          </footer>
        </blockquote>
      </motion.div>

      {/* Trigger emocional — tipografia forte */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="max-w-md w-full mx-auto mb-4"
      >
        <h2 className="text-[26px] sm:text-3xl font-black text-slate-900 leading-[1.05] tracking-tight">
          Metade.
        </h2>
        <p className="text-base font-medium text-slate-600 mt-1.5">Você vai...</p>
      </motion.div>

      {/* Opções — cards premium */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="max-w-md w-full mx-auto flex flex-col gap-2.5"
        role="radiogroup"
        aria-label="Sua reação"
      >
        {OPTIONS.map((opt, idx) => {
          const isSelected = picked === opt.value;
          const styles = ACCENT_STYLES[opt.accent];
          return (
            <motion.button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handlePick(opt.value)}
              disabled={submitting}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + idx * 0.08, duration: 0.35 }}
              whileTap={submitting ? undefined : { scale: 0.985 }}
              className={`group relative w-full text-left flex items-start gap-3 p-3 sm:p-3.5 rounded-2xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed ${
                isSelected
                  ? `${styles.selectedBorder} ${styles.selectedBg} ${styles.selectedShadow}`
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
              }`}
            >
              {/* Ícone em círculo elevado */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl ring-4 transition-all ${styles.iconBg} ${isSelected ? styles.iconRing : "ring-transparent"}`}
                aria-hidden="true"
              >
                {opt.emoji}
              </div>

              {/* Textos */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p
                  className={`text-[15px] sm:text-base font-bold leading-snug transition-colors ${
                    isSelected ? "text-slate-900" : "text-slate-900"
                  }`}
                >
                  {opt.title}
                </p>
                <p className="text-xs sm:text-[13px] text-slate-500 mt-1 leading-relaxed">
                  {opt.subtitle}
                </p>
              </div>

              {/* Indicador de seleção (check) */}
              <div
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  isSelected
                    ? opt.accent === "indigo"
                      ? "bg-indigo-500 scale-100"
                      : "bg-rose-500 scale-100"
                    : "bg-slate-100 scale-90 opacity-0 group-hover:opacity-50"
                }`}
                aria-hidden="true"
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Feedback condicional + CTA */}
      <AnimatePresence>
        {picked && (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="max-w-md w-full mx-auto mt-4 flex flex-col gap-2.5"
          >
            {/* Card de feedback elegante */}
            <div className="relative rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50/60 border border-indigo-100 px-4 py-3 overflow-hidden">
              <div
                className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-violet-500"
                aria-hidden="true"
              />
              <p className="text-[13px] text-slate-700 leading-snug pl-1">
                {FEEDBACK[picked]}
              </p>
            </div>

            {/* CTA premium */}
            <motion.button
              type="button"
              onClick={handleContinue}
              disabled={submitting}
              whileTap={!submitting ? { scale: 0.97 } : undefined}
              className="group relative w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_100%] text-white text-base font-bold shadow-[0_10px_30px_-10px_rgba(99,102,241,0.6)] hover:bg-[position:100%_0] hover:shadow-[0_15px_40px_-10px_rgba(99,102,241,0.7)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
            >
              <span className="relative flex items-center gap-2">
                {submitting ? "Salvando..." : "Continuar"}
                {!submitting && (
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                )}
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
