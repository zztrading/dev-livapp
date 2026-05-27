import { useState } from "react";
import { motion } from "framer-motion";
import type { FilterInterest } from "./useMiniExperience";

interface FilterInterestScreenProps {
  onSelect: (value: FilterInterest) => void | Promise<void>;
}

const OPTIONS: { value: FilterInterest; emoji: string; label: string; sub: string }[] = [
  {
    value: "visual",
    emoji: "🎨",
    label: "Uma imagem épica",
    sub: "que impressiona qualquer um",
  },
  {
    value: "writing",
    emoji: "✍️",
    label: "Um texto impecável",
    sub: "que engaja e vende",
  },
];

export const FilterInterestScreen = ({ onSelect }: FilterInterestScreenProps) => {
  const [picked, setPicked] = useState<FilterInterest | null>(null);

  const handleSelect = async (value: FilterInterest) => {
    if (picked) return;
    setPicked(value);
    await onSelect(value);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="min-h-screen flex flex-col px-5 sm:px-6 pt-16 pb-10"
    >
      <div className="max-w-md w-full mx-auto flex flex-col flex-1">
        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
          Mini-experiência · 1 de 7
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug mb-3">
          Imagine que a IA pode resolver algo pra você em 5 segundos.
        </h1>
        <p className="text-base text-slate-600 leading-relaxed mb-8">
          O que quer criar agora?
        </p>

        <div className="flex flex-col gap-3">
          {OPTIONS.map((opt, idx) => {
            const isPicked = picked === opt.value;
            return (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              disabled={picked !== null}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + idx * 0.1, duration: 0.35 }}
              whileTap={picked === null ? { scale: 0.98 } : undefined}
              className={`w-full text-left flex items-center gap-4 px-5 py-5 rounded-2xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                isPicked
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/40"
              } ${picked !== null && !isPicked ? "opacity-40" : ""}`}
            >
              <span className="text-3xl flex-shrink-0" aria-hidden="true">
                {opt.emoji}
              </span>
              <div className="flex-1">
                <div className="text-lg font-bold text-slate-900 leading-tight">
                  {opt.label}
                </div>
                <div className="text-sm text-slate-500 mt-1">{opt.sub}</div>
              </div>
            </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};
