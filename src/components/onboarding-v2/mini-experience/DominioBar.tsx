import { motion, AnimatePresence } from "framer-motion";
import { Brain } from "lucide-react";

interface DominioBarProps {
  score: number;
  lastPointsGained: number | null;
}

// Cap visual em 100 — bônus aparecem como "+X" overlay
const VISUAL_CAP = 100;

export const DominioBar = ({ score, lastPointsGained }: DominioBarProps) => {
  const fillPercent = Math.min(100, (score / VISUAL_CAP) * 100);
  const bonusOverflow = Math.max(0, score - VISUAL_CAP);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Domínio IA: ${score} de 100${lastPointsGained ? `, ganhou ${lastPointsGained} pontos` : ""}`}
    >
      <div className="max-w-md mx-auto px-4 py-2 flex items-center gap-3">
        <Brain className="w-4 h-4 text-indigo-500 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
            <span className="text-slate-500">Domínio IA</span>
            <span className="tabular-nums text-indigo-600">
              {Math.min(score, VISUAL_CAP)}
              {bonusOverflow > 0 && (
                <span className="text-amber-500 ml-1">+{bonusOverflow}</span>
              )}
              <span className="text-slate-400 ml-0.5">/100</span>
            </span>
          </div>
          <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${
                bonusOverflow > 0
                  ? "bg-gradient-to-r from-indigo-500 via-violet-500 to-amber-400"
                  : "bg-gradient-to-r from-indigo-500 to-violet-500"
              }`}
              initial={false}
              animate={{ width: `${fillPercent}%` }}
              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            />
            {/* Pulse de luz ao ganhar pontos */}
            <AnimatePresence>
              {lastPointsGained !== null && lastPointsGained > 0 && (
                <motion.div
                  key={`pulse-${score}`}
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.6 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="absolute inset-0 rounded-full bg-white/40"
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Toast flutuante "+X" ao ganhar pontos */}
        <AnimatePresence>
          {lastPointsGained !== null && lastPointsGained > 0 && (
            <motion.span
              key={`gain-${score}`}
              initial={{ opacity: 0, y: 8, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
              className="text-xs font-bold text-indigo-600 tabular-nums flex-shrink-0"
            >
              +{lastPointsGained}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
