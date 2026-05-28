import { motion, AnimatePresence } from "framer-motion";
import { Flame, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface ComboToastProps {
  streak: number;
  bonus: number | null;
}

interface ComboMeta {
  title: string;
  subtitle: string;
  emoji: string;
}

const COMBO_META: Record<number, ComboMeta> = {
  2: { title: "COMBO x2", subtitle: "Tá indo bem!", emoji: "🔥" },
  3: { title: "COMBO x3", subtitle: "Pegou o ritmo!", emoji: "⚡" },
  4: { title: "COMBO x4", subtitle: "TÁ VOANDO!", emoji: "🚀" },
};

/**
 * Toast dramático que aparece quando o usuário ganha um combo bonus.
 * Some sozinho após 4s (era 2.5s — pouco tempo pra ler/celebrar).
 *
 * Premium UX: card grande com glow forte, gradiente animado,
 * ícone com pulse, ENTRADA SPRING + SAÍDA SLIDE-UP delayed.
 */
export const ComboToast = ({ streak, bonus }: ComboToastProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (bonus !== null && bonus > 0) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(t);
    }
  }, [bonus, streak]);

  const meta = COMBO_META[streak as 2 | 3 | 4] ?? null;
  if (!meta || !bonus) return null;

  const isFour = streak >= 4;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.85 }}
          transition={{
            type: "spring",
            stiffness: 320,
            damping: 22,
            mass: 0.8,
          }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] pointer-events-none w-[calc(100vw-1.5rem)] max-w-sm flex justify-center"
        >
          <div className="relative">
            {/* Glow halo decorativo atrás do toast — agora atrelado ao tamanho real do pill */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1.4 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={`absolute inset-0 rounded-full blur-2xl ${
                isFour
                  ? "bg-gradient-to-r from-amber-400 to-orange-500"
                  : "bg-gradient-to-r from-amber-300 to-orange-400"
              }`}
              aria-hidden="true"
            />

            <div
              className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-sm ${
                isFour
                  ? "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white shadow-amber-500/50"
                  : "bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-amber-400/40"
              }`}
              role="status"
              aria-live="polite"
            >
            {/* Ícone com pulse */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, -8, 8, 0],
              }}
              transition={{
                duration: 0.8,
                repeat: 2,
                ease: "easeInOut",
              }}
              className="flex-shrink-0"
            >
              <span className="text-xl drop-shadow" aria-hidden="true">
                {meta.emoji}
              </span>
            </motion.div>

            <div className="flex flex-col items-start gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                <span className="text-[10px] font-black uppercase tracking-[0.12em] whitespace-nowrap">
                  {meta.title}
                </span>
              </div>
              <span className="text-[13px] font-bold whitespace-nowrap leading-none">
                {meta.subtitle}
              </span>
            </div>

            {/* Bonus em destaque com sparkle */}
            <div className="flex items-center gap-1 pl-2.5 ml-0.5 border-l border-white/30 flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="text-lg font-black tabular-nums whitespace-nowrap drop-shadow">
                +{bonus}
              </span>
            </div>
          </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
