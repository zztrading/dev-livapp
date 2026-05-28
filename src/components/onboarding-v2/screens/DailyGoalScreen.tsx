import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface DailyGoalScreenProps {
  selected?: string;
  onSelect: (value: string) => void;
  onBack?: () => void;
}

// 4 opções de meta diária. Default 20 XP (Regular) marcado pra reduzir
// fricção de decisão pra adulto sem referência prévia.
const GOALS = [
  { value: "10", label: "Casual", time: "~5 min/dia" },
  { value: "20", label: "Regular", time: "~10 min/dia", recommended: true },
  { value: "30", label: "Sério", time: "~15-20 min/dia" },
  { value: "50", label: "Intenso", time: "~25-30 min/dia" },
];

export const DailyGoalScreen = ({
  selected,
  onSelect,
  onBack,
}: DailyGoalScreenProps) => {
  // Default 20 XP marcado automaticamente quando entra na tela
  const [internalSelected, setInternalSelected] = useState(selected ?? "20");

  useEffect(() => {
    if (selected) setInternalSelected(selected);
  }, [selected]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="min-h-screen flex flex-col px-5 sm:px-6 pt-6 pb-32"
    >
      {/* Header */}
      <div className="flex items-center mb-7 max-w-md w-full mx-auto">
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

      {/* Pergunta */}
      <div className="max-w-md w-full mx-auto mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
          Qual vai ser a sua meta diária?
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Sem cobrança. Você ajusta quando quiser.
        </p>
      </div>

      {/* Opções de meta */}
      <div className="max-w-md w-full mx-auto flex flex-col gap-2.5">
        {GOALS.map((goal) => {
          const isSelected = internalSelected === goal.value;
          return (
            <motion.button
              key={goal.value}
              type="button"
              onClick={() => setInternalSelected(goal.value)}
              whileTap={{ scale: 0.98 }}
              className={`relative w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-indigo-300"
              }`}
            >
              {/* XP à esquerda — mais compacto em mobile */}
              <div
                className={`flex flex-col items-center justify-center flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${
                  isSelected
                    ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <span className="text-[17px] sm:text-lg font-bold tabular-nums leading-none">{goal.value}</span>
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold opacity-80 mt-0.5">
                  XP
                </span>
              </div>
              {/* Label + tempo */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[15px] sm:text-base font-bold ${isSelected ? "text-indigo-900" : "text-slate-900"}`}
                  >
                    {goal.label}
                  </span>
                  {goal.recommended && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                      <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
                      Recomendado
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 mt-0.5 block">
                  {goal.time}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* CTA Continuar — sticky bottom com safe-area */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent border-t border-zinc-100 px-5 sm:px-6 pt-3 z-20"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-md w-full mx-auto">
          <motion.button
            type="button"
            onClick={() => onSelect(internalSelected)}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Continuar
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};
