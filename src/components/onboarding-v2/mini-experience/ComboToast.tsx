import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";
import { useEffect, useState } from "react";

interface ComboToastProps {
  streak: number;
  bonus: number | null;
}

const MESSAGES: Record<number, string> = {
  2: "2 seguidas!",
  3: "3 seguidas!",
  4: "4 SEGUIDAS — tu tá voando!",
};

/**
 * Toast efêmero que aparece quando o usuário ganha um combo bonus.
 * Some sozinho após ~2.5s.
 */
export const ComboToast = ({ streak, bonus }: ComboToastProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (bonus !== null && bonus > 0) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2500);
      return () => clearTimeout(t);
    }
  }, [bonus, streak]);

  const message = MESSAGES[streak as 2 | 3 | 4] ?? null;
  if (!message || !bonus) return null;

  const isFour = streak >= 4;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          className="fixed top-12 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
        >
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg shadow-amber-500/30 ${
              isFour
                ? "bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 text-white"
                : "bg-amber-100 border border-amber-300 text-amber-900"
            }`}
            role="status"
            aria-live="polite"
          >
            <Flame
              className={`w-4 h-4 flex-shrink-0 ${isFour ? "text-white" : "text-amber-600"}`}
              aria-hidden="true"
            />
            <span className="text-sm font-bold whitespace-nowrap">
              🔥 {message} +{bonus} bônus
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
