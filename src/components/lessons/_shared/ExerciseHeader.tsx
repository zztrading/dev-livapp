import { Target, type LucideIcon } from "lucide-react";

interface ExerciseHeaderProps {
  /** Eyebrow above question, e.g. "Exercício" or "Cenário 2 de 3" */
  eyebrow?: string;
  /** Main question text */
  question: string;
  /** Optional secondary instruction shown below the question */
  instruction?: string;
  icon?: LucideIcon;
}

/**
 * Premium minimal exercise header.
 * - No tinted icon tile, no emoji.
 * - Eyebrow (uppercase, tracked) + bold question + soft secondary line.
 */
export function ExerciseHeader({
  eyebrow = "Exercício",
  question,
  instruction,
  icon: Icon = Target,
}: ExerciseHeaderProps) {
  return (
    <header className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
        <span>{eyebrow}</span>
      </div>
      <h3 className="text-[17px] sm:text-xl font-semibold leading-snug tracking-tight text-foreground">
        {question}
      </h3>
      {instruction && (
        <p className="text-sm text-muted-foreground leading-relaxed">{instruction}</p>
      )}
    </header>
  );
}
