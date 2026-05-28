import { useState } from "react";
import type { FilterInterest } from "./useMiniExperience";

interface FilterInterestScreenProps {
  stepLabel: string;
  onSelect: (value: FilterInterest) => void | Promise<void>;
}

const OPTIONS: {
  value: FilterInterest;
  emoji: string;
  label: string;
  sub: string;
}[] = [
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

export const FilterInterestScreen = ({
  stepLabel,
  onSelect,
}: FilterInterestScreenProps) => {
  const [picked, setPicked] = useState<FilterInterest | null>(null);

  const handleSelect = async (value: FilterInterest) => {
    if (picked) return;
    setPicked(value);
    await onSelect(value);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white pt-24">
      <main className="flex-1 px-4 pt-4 pb-10 max-w-md w-full mx-auto flex flex-col gap-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-violet-700">
          {stepLabel}
        </span>

        <h1 className="text-[20px] sm:text-[23px] font-bold leading-[1.28] tracking-[-0.025em] text-zinc-950">
          <span className="block text-[14.5px] sm:text-[15.5px] font-normal text-zinc-700 leading-[1.5] mb-2 tracking-[-0.005em]">
            Imagine que a IA pode resolver algo pra você em 5 segundos.
          </span>
          O que quer criar agora?
        </h1>

        <div className="flex flex-col gap-2 mt-2">
          {OPTIONS.map((opt) => {
            const isPicked = picked === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                disabled={picked !== null}
                className={`group relative w-full text-left flex items-start gap-3 px-3.5 py-3.5 rounded-[14px] border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 active:scale-[0.99] ${
                  isPicked
                    ? "bg-violet-50 border-violet-300"
                    : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                } ${picked !== null && !isPicked ? "opacity-[0.55]" : ""}`}
              >
                <span
                  className="flex-shrink-0 text-[22px] leading-none mt-[2px]"
                  aria-hidden="true"
                >
                  {opt.emoji}
                </span>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold leading-[1.25] text-zinc-950 tracking-[-0.005em]">
                    {opt.label}
                  </div>
                  <div className="text-[12.5px] text-zinc-500 mt-0.5 leading-[1.4]">
                    {opt.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
};
