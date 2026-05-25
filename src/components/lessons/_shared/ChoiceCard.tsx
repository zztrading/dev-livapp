import { CheckCircle2, XCircle, Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type ChoiceState = "idle" | "selected" | "correct" | "wrong" | "reveal-correct";

interface ChoiceCardProps {
  title: string;
  description?: string;
  state: ChoiceState;
  disabled?: boolean;
  onClick?: () => void;
  /** Optional leading element (number, letter, emoji-replacement icon) */
  leading?: React.ReactNode;
  /** index for stagger animation */
  index?: number;
}

const stateStyles: Record<ChoiceState, string> = {
  idle:
    "border-border/70 bg-card hover:border-primary/40 hover:bg-primary/[0.03] active:scale-[0.99]",
  selected:
    "border-primary bg-primary/[0.06] ring-2 ring-primary/20 shadow-sm",
  correct:
    "border-success bg-success/5",
  wrong:
    "border-destructive bg-destructive/5",
  "reveal-correct":
    "border-success/50 bg-success/[0.04]",
};

/**
 * Premium iOS-style choice card.
 * - Clear selected state (ring + shadow + soft tint)
 * - Big tap target (min-h 60px), no truncation
 * - Subtle press feedback
 */
export function ChoiceCard({
  title,
  description,
  state,
  disabled,
  onClick,
  leading,
  index = 0,
}: ChoiceCardProps) {
  const showCheck = state === "correct" || state === "reveal-correct";
  const showCross = state === "wrong";

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.22 }}
      whileTap={!disabled ? { scale: 0.985 } : undefined}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative w-full text-left rounded-2xl border-2 transition-all duration-200",
        "px-4 py-3.5 sm:px-5 sm:py-4 min-h-[60px]",
        "flex items-center gap-3",
        stateStyles[state],
        disabled && state === "idle" && "opacity-60 cursor-not-allowed",
        !disabled && "cursor-pointer",
      )}
    >
      {leading !== undefined ? (
        <span className="flex-shrink-0">{leading}</span>
      ) : (
        <span
          className={cn(
            "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
            state === "selected" && "border-primary bg-primary",
            state === "correct" && "border-success bg-success",
            state === "reveal-correct" && "border-success bg-success",
            state === "wrong" && "border-destructive bg-destructive",
            state === "idle" && "border-muted-foreground/30 group-hover:border-primary/50",
          )}
        >
          {(state === "selected" || state === "correct" || state === "reveal-correct") && (
            <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3.5} />
          )}
        </span>
      )}

      <span className="flex-1 min-w-0">
        <span className="block text-[15px] sm:text-base font-semibold text-foreground leading-snug">
          {title}
        </span>
        {description && (
          <span className="block mt-0.5 text-[13px] text-muted-foreground leading-relaxed">
            {description}
          </span>
        )}
      </span>

      {showCheck && (
        <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 animate-scale-in" />
      )}
      {showCross && (
        <XCircle className="w-5 h-5 text-destructive flex-shrink-0 animate-scale-in" />
      )}
    </motion.button>
  );
}
