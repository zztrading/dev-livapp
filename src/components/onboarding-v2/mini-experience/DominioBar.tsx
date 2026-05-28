import { motion, AnimatePresence } from "framer-motion";
import { Brain } from "lucide-react";
import { HeartsBar } from "../HeartsBar";

interface DominioBarProps {
  score: number;
  lastPointsGained: number | null;
  /** Quando true, oculta animação visual (usado na Antecipação — silêncio visual) */
  silent?: boolean;
  /** Hearts current (0-5) — quando definido renderiza HeartsBar inline (spec linha 670) */
  hearts?: number;
  /** Timestamp da última vida perdida (pra disparar animação shake) */
  heartsLastLostAt?: number | null;
  /** Timestamp da última vida ganha (pra disparar animação fade-in) */
  heartsLastGainedAt?: number | null;
}

// Spec onboarding v2 (linhas 39-43): 4 estados visuais por faixa de Domínio.
// Glow sempre presente (mais sutil em baixo, dramático em 90+).
type DominioState = "neutral" | "blue" | "green" | "orange-glow";

function stateFromScore(score: number): DominioState {
  if (score >= 90) return "orange-glow";
  if (score >= 70) return "green";
  if (score >= 45) return "blue";
  return "neutral";
}

const STATE_STYLES: Record<
  DominioState,
  {
    fill: string;
    text: string;
    iconBg: string;
    glow: string;
    pillBg: string;
    label?: string;
  }
> = {
  neutral: {
    fill: "bg-gradient-to-r from-slate-400 via-slate-500 to-slate-500",
    text: "text-slate-700",
    iconBg: "bg-slate-100",
    glow: "shadow-[0_0_8px_rgba(100,116,139,0.3)]",
    pillBg: "bg-slate-100 text-slate-700",
  },
  blue: {
    fill: "bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500",
    text: "text-blue-700",
    iconBg: "bg-blue-100",
    glow: "shadow-[0_0_12px_rgba(59,130,246,0.4)]",
    pillBg: "bg-blue-100 text-blue-700",
  },
  green: {
    fill: "bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500",
    text: "text-emerald-700",
    iconBg: "bg-emerald-100",
    glow: "shadow-[0_0_14px_rgba(16,185,129,0.5)]",
    pillBg: "bg-emerald-100 text-emerald-700",
  },
  "orange-glow": {
    fill: "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500",
    text: "text-orange-700",
    iconBg: "bg-gradient-to-br from-amber-100 to-orange-100",
    glow: "shadow-[0_0_20px_rgba(251,146,60,0.7)]",
    pillBg: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    label: "🔥",
  },
};

export const DominioBar = ({
  score,
  lastPointsGained,
  silent = false,
  hearts,
  heartsLastLostAt = null,
  heartsLastGainedAt = null,
}: DominioBarProps) => {
  const cappedScore = Math.min(100, score);
  const fillPercent = (cappedScore / 100) * 100;
  const visualState = stateFromScore(cappedScore);
  const styles = STATE_STYLES[visualState];

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200/60 shadow-sm"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Domínio IA: ${cappedScore} de 100${lastPointsGained && !silent ? `, ganhou ${lastPointsGained} pontos` : ""}`}
    >
      <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
        {/* Ícone Brain em círculo elevado */}
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${styles.iconBg}`}
          aria-hidden="true"
        >
          <Brain className={`w-5 h-5 transition-colors ${styles.text}`} strokeWidth={2.5} />
        </div>

        {/* Centro: label + score + barra */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 truncate">
              Domínio IA {styles.label && <span aria-hidden="true">{styles.label}</span>}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Toast "+X" pill (oculto se silent) */}
              <AnimatePresence>
                {!silent && lastPointsGained !== null && lastPointsGained > 0 && (
                  <motion.span
                    key={`gain-${score}-${lastPointsGained}`}
                    initial={{ opacity: 0, y: -8, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    className={`text-[11px] font-black tabular-nums px-2 py-0.5 rounded-full ${styles.pillBg}`}
                  >
                    +{lastPointsGained}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Score atual em destaque */}
              <span className={`text-lg font-black tabular-nums transition-colors ${styles.text}`}>
                {cappedScore}
                <span className="text-xs text-slate-400 ml-0.5 font-bold">/100</span>
              </span>
            </div>
          </div>

          {/* Barra mais alta + glow sempre presente */}
          <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${styles.fill} ${styles.glow}`}
              initial={false}
              animate={{ width: `${fillPercent}%` }}
              transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            />

            {/* Sweep light effect ao ganhar pontos */}
            <AnimatePresence>
              {!silent && lastPointsGained !== null && lastPointsGained > 0 && (
                <motion.div
                  key={`sweep-${score}`}
                  initial={{ x: "-100%", opacity: 0.8 }}
                  animate={{ x: "100%", opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                  style={{ left: 0 }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Hearts inline no header — spec linha 670 */}
        {hearts !== undefined && (
          <div className="flex-shrink-0 ml-0.5">
            <HeartsBar
              lives={hearts}
              lastLostAt={silent ? null : heartsLastLostAt}
              lastGainedAt={silent ? null : heartsLastGainedAt}
            />
          </div>
        )}
      </div>
    </div>
  );
};
