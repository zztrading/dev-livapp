import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";

interface HeartsBarProps {
  lives: number;
  max?: number;
  lastLostAt?: number | null;
  lastGainedAt?: number | null;
}

const MAX_LIVES_DEFAULT = 5;

export const HeartsBar = ({
  lives,
  max = MAX_LIVES_DEFAULT,
  lastLostAt = null,
  lastGainedAt = null,
}: HeartsBarProps) => {
  const livesClamped = Math.max(0, Math.min(max, lives));

  return (
    <div
      className="flex items-center gap-1.5"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Vidas: ${livesClamped} de ${max}`}
      title="Vidas são suas tentativas. Recupera no Mistake Review."
    >
      {Array.from({ length: max }).map((_, idx) => {
        const filled = idx < livesClamped;
        return (
          <span
            key={idx}
            className="relative inline-flex items-center justify-center"
          >
            <Heart
              className={`w-4 h-4 transition-colors duration-300 ${
                filled
                  ? "fill-rose-500 text-rose-500"
                  : "fill-slate-200 text-slate-300"
              }`}
              aria-hidden="true"
            />
            <AnimatePresence>
              {lastLostAt && idx === livesClamped && !filled && (
                <motion.span
                  key={`shake-${lastLostAt}-${idx}`}
                  initial={{ opacity: 1, x: 0 }}
                  animate={{ opacity: 0, x: [0, -3, 3, -2, 2, 0] }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 rounded-full bg-rose-200/40 pointer-events-none"
                />
              )}
              {lastGainedAt && idx === livesClamped - 1 && filled && (
                <motion.span
                  key={`gain-${lastGainedAt}-${idx}`}
                  initial={{ opacity: 0.6, scale: 0.8 }}
                  animate={{ opacity: 0, scale: 1.6 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 rounded-full bg-rose-300/40 pointer-events-none"
                />
              )}
            </AnimatePresence>
          </span>
        );
      })}
    </div>
  );
};
