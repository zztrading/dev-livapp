import { motion } from "framer-motion";

interface ChoiceCardProps {
  emoji?: string;
  label: string;
  subtitle?: string;
  selected?: boolean;
  highlight?: boolean;
  onClick: () => void;
}

export const ChoiceCard = ({
  emoji,
  label,
  subtitle,
  selected = false,
  highlight = false,
  onClick,
}: ChoiceCardProps) => {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
        selected
          ? "border-indigo-500 bg-indigo-50 shadow-sm"
          : highlight
            ? "border-amber-300 bg-amber-50/40 hover:border-amber-400"
            : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"
      }`}
    >
      {emoji && (
        <span className="text-2xl flex-shrink-0" aria-hidden="true">
          {emoji}
        </span>
      )}
      <span className="flex-1 flex flex-col">
        <span className={`text-base font-semibold ${selected ? "text-indigo-900" : "text-slate-900"}`}>
          {label}
        </span>
        {subtitle && (
          <span className="text-xs text-slate-500 mt-0.5">{subtitle}</span>
        )}
      </span>
    </motion.button>
  );
};
